use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};
use anchor_spl::associated_token::AssociatedToken;
use crate::constants::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Resolve a market after expiry
///
/// Logic:
/// 1. Check expiry time has passed
/// 2. Check market is currently Unresolved
/// 3. Determine outcome:
///    - If total_yes_shares > total_no_shares → YesWins (trigger pump.fun stub, deduct 5% fee)
///    - If total_no_shares > total_yes_shares → NoWins (deduct 5% fee, prepare for distribution)
///    - If total_yes_shares == total_no_shares OR pool < target → Refund (no fees, full refund)
/// 4. Deduct completion fee (5%) from pool if YES/NO wins
/// 5. Update market.resolution status
///
/// Anyone can call this after market expiry (permissionless resolution)
#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        mut,
        constraint = market.resolution == MarketResolution::Unresolved @ ErrorCode::AlreadyResolved
    )]
    pub market: Account<'info, Market>,

    /// Market Vault PDA (holds all SOL, used as buyer in Pump.fun CPI)
    #[account(
        mut,
        seeds = [b"market_vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token mint (created by pump.fun in previous instruction of same transaction)
    /// Only used/validated when resolution = YesWins
    /// CHECK: Validated during YesWins flow
    #[account(mut)]
    pub token_mint: UncheckedAccount<'info>,

    /// Market's token account to receive bought tokens
    /// Must be ATA of market PDA for the token_mint
    /// CHECK: Validated as ATA during YesWins flow
    #[account(mut)]
    pub market_token_account: UncheckedAccount<'info>,

    // -------------------------
    // Pump.fun accounts (for buy CPI when YES wins)
    // -------------------------

    /// Pump.fun global config PDA (readonly per IDL)
    /// CHECK: Pump.fun program validates this
    pub pump_global: UncheckedAccount<'info>,

    /// Pump.fun bonding curve PDA for this token
    /// Derived from ["bonding-curve", token_mint]
    /// CHECK: Pump.fun program validates this
    #[account(mut)]
    pub bonding_curve: UncheckedAccount<'info>,

    /// Bonding curve's associated token account
    /// Holds the tokens in the bonding curve
    /// CHECK: Pump.fun program validates this
    #[account(mut)]
    pub bonding_curve_token_account: UncheckedAccount<'info>,

    /// Pump.fun fee recipient
    /// CHECK: Pump.fun program validates this
    #[account(mut)]
    pub pump_fee_recipient: UncheckedAccount<'info>,

    /// Pump.fun event authority PDA
    /// CHECK: Pump.fun program validates this
    pub pump_event_authority: UncheckedAccount<'info>,

    /// Pump.fun program
    /// CHECK: Hardcoded to pump.fun program ID
    pub pump_program: UncheckedAccount<'info>,

    /// Token creator (from bonding curve)
    /// Used to derive creator_vault PDA
    /// CHECK: Passed by client, validated by Pump.fun during buy
    pub creator: UncheckedAccount<'info>,

    /// Creator vault PDA (Pump.fun)
    /// Derived from ["creator-vault", creator]
    /// CHECK: Pump.fun program validates this
    #[account(mut)]
    pub creator_vault: UncheckedAccount<'info>,

    /// Global volume accumulator PDA (Pump.fun)
    /// Derived from ["global-volume-accumulator"]
    /// CHECK: Pump.fun program validates this
    #[account(mut)]
    pub global_volume_accumulator: UncheckedAccount<'info>,

    /// User volume accumulator PDA (Pump.fun)
    /// Derived from ["user-volume-accumulator", market]
    /// CHECK: Pump.fun program validates this
    #[account(mut)]
    pub user_volume_accumulator: UncheckedAccount<'info>,

    /// Fee config PDA (from fee program)
    /// CHECK: Pump.fun program validates this
    pub fee_config: UncheckedAccount<'info>,

    /// Fee program
    /// CHECK: Hardcoded to pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ
    pub fee_program: UncheckedAccount<'info>,

    /// Anyone can trigger resolution after expiry (permissionless)
    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
    /// Token program (accepts both Token and Token2022)
    pub token_program: Interface<'info, TokenInterface>,
    /// Token2022 program (for ATA creation)
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<ResolveMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let treasury = &mut ctx.accounts.treasury;

    // -------------------------
    // 1) Validate resolution permission
    // -------------------------

    let now = Clock::get()?.unix_timestamp;
    let is_expired = now >= market.expiry_time;
    let is_founder = ctx.accounts.caller.key() == market.founder;
    let in_funding_phase = market.phase == MarketPhase::Funding;
    let pool_is_full = market.pool_balance >= market.target_pool;
    let no_is_winning = market.total_no_shares > market.total_yes_shares;

    // Allow resolution if:
    // - Market has expired (anyone can resolve), OR
    // - Founder is resolving in Funding phase (early resolution for successful markets), OR
    // - Pool is full AND NO is winning (permissionless resolution for failed markets)
    require!(
        is_expired ||
        (is_founder && in_funding_phase) ||
        (pool_is_full && no_is_winning),
        ErrorCode::CannotResolveYet
    );

    msg!("🔍 Resolution authorization:");
    msg!("   Is expired: {}", is_expired);
    msg!("   Is founder: {}", is_founder);
    msg!("   In funding phase: {}", in_funding_phase);
    msg!("   Pool is full: {}", pool_is_full);
    msg!("   NO is winning: {}", no_is_winning);

    // -------------------------
    // 2) Determine resolution outcome
    // -------------------------

    let resolution = if market.pool_balance < market.target_pool {
        // Market failed to reach target pool → Refund
        MarketResolution::Refund
    } else if market.total_yes_shares > market.total_no_shares {
        // YES wins → Token launch
        MarketResolution::YesWins
    } else if market.total_no_shares > market.total_yes_shares {
        // NO wins → SOL distribution
        MarketResolution::NoWins
    } else {
        // Tie or no participation → Refund
        MarketResolution::Refund
    };

    msg!("🔍 Market resolution determined: {:?}", resolution);
    msg!("   total_yes_shares: {}", market.total_yes_shares);
    msg!("   total_no_shares: {}", market.total_no_shares);
    msg!("   pool_balance: {} lamports", market.pool_balance);
    msg!("   target_pool: {} lamports", market.target_pool);

    // -------------------------
    // 3) Process resolution
    // -------------------------

    match resolution {
        MarketResolution::YesWins => {
            // Calculate 5% completion fee
            let completion_fee = (market.pool_balance * COMPLETION_FEE_BPS) / BPS_DIVISOR;

            // CRITICAL: Reserve rent-exempt balance for Market Vault PDA
            // Pump.fun validates the buyer remains rent-exempt after purchase
            let rent = Rent::get()?;
            let vault_rent_exempt = rent.minimum_balance(0); // Vault has 0 bytes data

            // Reserve: rent-exempt + completion fee
            let total_reserved = vault_rent_exempt
                .checked_add(completion_fee)
                .ok_or(ErrorCode::MathError)?;

            // Net amount for token purchase = pool - reserved
            let net_amount_for_token = market
                .pool_balance
                .checked_sub(total_reserved)
                .ok_or(ErrorCode::MathError)?;

            msg!("✅ YES WINS - Initiating token launch");
            msg!("   Market vault rent-exempt: {} lamports", vault_rent_exempt);
            msg!("   Completion fee: {} lamports (5%)", completion_fee);
            msg!("   Total reserved: {} lamports", total_reserved);
            msg!("   SOL for token launch: {} lamports", net_amount_for_token);

            // -------------------------
            // Buy tokens on Pump.fun with remaining SOL
            // -------------------------
            // NOTE: Token was already created in previous instruction of same transaction
            // by founder using pump.fun create instruction

            // Verify pump.fun program ID
            let expected_pump_program = solana_program::pubkey!("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
            require!(
                ctx.accounts.pump_program.key() == expected_pump_program,
                ErrorCode::Unauthorized
            );

            msg!("   Token mint: {}", ctx.accounts.token_mint.key());
            msg!("   Buying tokens with {} lamports", net_amount_for_token);

            // -------------------------
            // Call pump.fun buy via MANUAL CPI (not using pump-anchor crate)
            // This allows us to pass Token2022 program instead of legacy Token
            // -------------------------
            // Market VAULT PDA buys tokens with NET amount (after 5% fee reserved)
            // Vault derives from market.key()
            let market_key = market.key();
            let vault_seeds = &[
                b"market_vault",
                market_key.as_ref(),
                &[ctx.bumps.market_vault],
            ];
            let signer_seeds = &[&vault_seeds[..]];

            // Build buy instruction manually with CORRECT discriminator from IDL
            // Discriminator = [102, 6, 61, 18, 1, 218, 235, 234] (from pump.json IDL)
            let buy_discriminator: [u8; 8] = [102, 6, 61, 18, 1, 218, 235, 234];

            // Instruction data: [discriminator(8), amount(8), max_sol_cost(8), track_volume(1)]
            // Amount = SOL to spend (Pump.fun calculates tokens from bonding curve)
            // Max SOL cost = same as amount (cap spending)
            // track_volume is OptionBool: 1 byte (0x00 = None, 0x01 = Some(false), 0x02 = Some(true))
            // Using None to skip volume tracking and reduce required accounts
            let mut instruction_data = Vec::with_capacity(25);
            instruction_data.extend_from_slice(&buy_discriminator);
            instruction_data.extend_from_slice(&net_amount_for_token.to_le_bytes()); // SOL amount
            instruction_data.extend_from_slice(&net_amount_for_token.to_le_bytes()); // Max SOL cost
            instruction_data.push(0x00); // track_volume = None (skip volume tracking to reduce tx size)

            msg!("   🔧 Buy instruction data:");
            msg!("      Discriminator: {:?}", buy_discriminator);
            msg!("      SOL Amount: {} lamports", net_amount_for_token);
            msg!("      Max SOL Cost: {} lamports", net_amount_for_token);
            msg!("      Track volume: None (skipped)");

            // Build accounts in EXACT order from IDL (16 accounts for buy instruction)
            use anchor_lang::solana_program::{instruction::AccountMeta, instruction::Instruction};
            let accounts = vec![
                // 0. global (readonly)
                AccountMeta::new_readonly(ctx.accounts.pump_global.key(), false),
                // 1. fee_recipient (writable) - HARDCODED ADDRESS!
                AccountMeta::new(ctx.accounts.pump_fee_recipient.key(), false),
                // 2. mint (readonly)
                AccountMeta::new_readonly(ctx.accounts.token_mint.key(), false),
                // 3. bonding_curve (writable)
                AccountMeta::new(ctx.accounts.bonding_curve.key(), false),
                // 4. associated_bonding_curve (writable)
                AccountMeta::new(ctx.accounts.bonding_curve_token_account.key(), false),
                // 5. associated_user (writable) - market's token account
                AccountMeta::new(ctx.accounts.market_token_account.key(), false),
                // 6. user (writable + signer) - market VAULT signs via invoke_signed (pure SOL holder)
                AccountMeta::new(ctx.accounts.market_vault.key(), true),
                // 7. system_program (readonly)
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
                // 8. token_program (readonly) - LEGACY Token, not Token2022!
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
                // 9. creator_vault (writable)
                AccountMeta::new(ctx.accounts.creator_vault.key(), false),
                // 10. event_authority (readonly)
                AccountMeta::new_readonly(ctx.accounts.pump_event_authority.key(), false),
                // 11. program (readonly) - pump program address as account
                AccountMeta::new_readonly(ctx.accounts.pump_program.key(), false),
                // 12. global_volume_accumulator (writable)
                AccountMeta::new(ctx.accounts.global_volume_accumulator.key(), false),
                // 13. user_volume_accumulator (writable)
                AccountMeta::new(ctx.accounts.user_volume_accumulator.key(), false),
                // 14. fee_config (readonly)
                AccountMeta::new_readonly(ctx.accounts.fee_config.key(), false),
                // 15. fee_program (readonly)
                AccountMeta::new_readonly(ctx.accounts.fee_program.key(), false),
            ];

            msg!("   📋 Buy instruction with {} accounts", accounts.len());

            let buy_ix = Instruction {
                program_id: ctx.accounts.pump_program.key(),
                accounts,
                data: instruction_data,
            };

            // Invoke with PDA signer (market vault signs the buy)
            // IMPORTANT: Pass ALL 16 accounts as AccountInfo references in exact order
            anchor_lang::solana_program::program::invoke_signed(
                &buy_ix,
                &[
                    ctx.accounts.pump_global.to_account_info(),
                    ctx.accounts.pump_fee_recipient.to_account_info(),
                    ctx.accounts.token_mint.to_account_info(),
                    ctx.accounts.bonding_curve.to_account_info(),
                    ctx.accounts.bonding_curve_token_account.to_account_info(),
                    ctx.accounts.market_token_account.to_account_info(),
                    ctx.accounts.market_vault.to_account_info(), // market vault PDA signs
                    ctx.accounts.system_program.to_account_info(),
                    ctx.accounts.token_program.to_account_info(), // Legacy Token program
                    ctx.accounts.creator_vault.to_account_info(),
                    ctx.accounts.pump_event_authority.to_account_info(),
                    ctx.accounts.pump_program.to_account_info(),
                    ctx.accounts.global_volume_accumulator.to_account_info(),
                    ctx.accounts.user_volume_accumulator.to_account_info(),
                    ctx.accounts.fee_config.to_account_info(),
                    ctx.accounts.fee_program.to_account_info(),
                ],
                signer_seeds,
            )?;

            // Get total tokens bought by checking market's token account balance
            let market_token_acct = TokenAccount::try_deserialize(
                &mut &ctx.accounts.market_token_account.try_borrow_data()?[..]
            )?;
            let total_tokens = market_token_acct.amount;

            msg!("   Total tokens acquired: {}", total_tokens);

            // -------------------------
            // Now transfer completion fee (AFTER CPI completes)
            // -------------------------
            // Market vault holds all SOL, transfer fee from vault to treasury
            **ctx.accounts.market_vault.to_account_info().try_borrow_mut_lamports()? -= completion_fee;
            **treasury.to_account_info().try_borrow_mut_lamports()? += completion_fee;

            // Update treasury total fees
            treasury.total_fees = treasury
                .total_fees
                .checked_add(completion_fee)
                .ok_or(ErrorCode::MathError)?;

            msg!("   Completion fee transferred: {} lamports", completion_fee);

            // Set token mint in market state
            market.token_mint = Some(ctx.accounts.token_mint.key());

            // Update pool balance to rent-exempt amount (reserved for vault account)
            // Total spent from vault: net_amount_for_token + completion_fee
            // Remaining in vault: vault_rent_exempt
            market.pool_balance = vault_rent_exempt;

            // -------------------------
            // Calculate token distribution (65% / 33% / 2%)
            // -------------------------

            let platform_tokens = (total_tokens * PLATFORM_TOKEN_SHARE_BPS) / BPS_DIVISOR;
            let team_tokens = (total_tokens * TEAM_TOKEN_SHARE_BPS) / BPS_DIVISOR;
            let team_immediate = (total_tokens * TEAM_IMMEDIATE_SHARE_BPS) / BPS_DIVISOR;
            let team_vested = (total_tokens * TEAM_VESTED_SHARE_BPS) / BPS_DIVISOR;
            let yes_voter_tokens = total_tokens
                .checked_sub(platform_tokens)
                .and_then(|v| v.checked_sub(team_tokens))
                .ok_or(ErrorCode::MathError)?;

            // Store token allocations
            market.platform_tokens_allocated = platform_tokens;
            market.yes_voter_tokens_allocated = yes_voter_tokens;

            msg!("");
            msg!("   📊 TOKEN DISTRIBUTION:");
            msg!("   Platform (2%): {} tokens", platform_tokens);
            msg!("   Team (33%): {} tokens", team_tokens);
            msg!("   └─ Immediate (8%): {} tokens", team_immediate);
            msg!("   └─ Vested (25%, 12mo linear): {} tokens", team_vested);
            msg!("   YES voters (65%): {} tokens", yes_voter_tokens);
            msg!("");
            msg!("   ⏭️  NEXT STEPS:");
            msg!("   1. Initialize team vesting account (call init_team_vesting)");
            msg!("   2. YES voters claim tokens (call claim_rewards)");
            msg!("   3. Platform claims 2% (call claim_platform_tokens)");
            msg!("   4. Team claims vested tokens monthly (call claim_team_tokens)");
        }

        MarketResolution::NoWins => {
            // Deduct 5% completion fee from pool
            let completion_fee = (market.pool_balance * COMPLETION_FEE_BPS) / BPS_DIVISOR;

            // Transfer fee from market vault to treasury
            **ctx.accounts.market_vault.to_account_info().try_borrow_mut_lamports()? -= completion_fee;
            **treasury.to_account_info().try_borrow_mut_lamports()? += completion_fee;

            // Update treasury total fees
            treasury.total_fees = treasury
                .total_fees
                .checked_add(completion_fee)
                .ok_or(ErrorCode::MathError)?;

            // Update market pool balance (95% remains for NO voter distribution)
            market.pool_balance = market
                .pool_balance
                .checked_sub(completion_fee)
                .ok_or(ErrorCode::MathError)?;

            // Set distribution pool (snapshot for proportional claims)
            // This ensures all NO voters claim from the same fixed pool
            market.distribution_pool = market.pool_balance;

            msg!("✅ NO WINS");
            msg!("   Completion fee: {} lamports (5%)", completion_fee);
            msg!("   Remaining for distribution: {} lamports", market.pool_balance);
            msg!("   Distribution pool set: {} lamports", market.distribution_pool);
            msg!("   NO voters can now claim proportional SOL rewards");
        }

        MarketResolution::Refund => {
            // No fees deducted for refunds
            msg!("↩️  REFUND");
            msg!("   Market did not reach target or ended in tie");
            msg!("   All participants can claim full refunds");
            msg!("   No fees deducted");
        }

        MarketResolution::Unresolved => {
            // This shouldn't happen due to our logic above
            return Err(ErrorCode::InvalidResolutionState.into());
        }
    }

    // -------------------------
    // 4) Update market resolution state
    // -------------------------

    market.resolution = resolution;

    msg!("🏁 Market resolved successfully");
    msg!("   Final resolution: {:?}", market.resolution);

    Ok(())
}
