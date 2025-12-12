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

    // -------------------------
    // 3) Process resolution
    // -------------------------

    match resolution {
        MarketResolution::YesWins => {
            // CRITICAL: Use vault's ACTUAL lamport balance, not market.pool_balance
            // market.pool_balance may be out of sync if buy_yes/buy_no had issues
            // Vault's actual balance is the source of truth for available SOL
            let vault_lamports = ctx.accounts.market_vault.lamports();

            // 1. Calculate 5% completion fee FIRST
            let completion_fee = (vault_lamports * COMPLETION_FEE_BPS) / BPS_DIVISOR;

            // 2. Calculate SOL available after fee
            let sol_after_fee = vault_lamports
                .checked_sub(completion_fee)
                .ok_or(ErrorCode::MathError)?;

            // 3. Determine SOL for token purchase (capped at 50 SOL)
            let _sol_for_token_purchase = std::cmp::min(sol_after_fee, MAX_POOL_FOR_TOKEN_LAUNCH);

            // 4. Calculate excess SOL (if pool > 50 SOL after fee)
            let excess_sol = sol_after_fee.saturating_sub(MAX_POOL_FOR_TOKEN_LAUNCH);

            // 5. Reserve rent-exempt for vault
            let rent = Rent::get()?;
            let vault_rent_exempt = rent.minimum_balance(0);

            // 6. Calculate net amount for token purchase
            let total_reserved = vault_rent_exempt + completion_fee + excess_sol;
            let net_amount_for_token = vault_lamports
                .checked_sub(total_reserved)
                .ok_or(ErrorCode::MathError)?;

            // msg!("💰 Pool allocation breakdown:");
            // msg!("   Total vault: {} lamports", vault_lamports);
            // msg!("   Completion fee (5%): {} lamports", completion_fee);
            // msg!("   SOL for token purchase: {} lamports", net_amount_for_token);
            // if excess_sol > 0 {
            //     msg!("   Excess SOL for founder vesting: {} lamports", excess_sol);
            // }

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

            // -------------------------
            // Calculate token amount from SOL using bonding curve formula
            // -------------------------
            // CRITICAL: Pump.fun Buy expects TOKEN AMOUNT (6 decimals), NOT SOL amount!
            // Read bonding curve reserves to calculate tokens
            let bonding_curve_data = ctx.accounts.bonding_curve.try_borrow_data()?;

            // Validate bonding curve account has enough data
            require!(
                bonding_curve_data.len() >= 32,
                ErrorCode::InvalidAccountData
            );

            // Parse virtual reserves from bonding curve account
            // Bonding curve layout: [discriminator(8), virtual_token_reserves(8), virtual_sol_reserves(8), ...]
            // Offset 0x08: virtual_token_reserves (u64)
            // Offset 0x10: virtual_sol_reserves (u64)
            let virtual_token_reserves = u64::from_le_bytes(
                bonding_curve_data[8..16].try_into().map_err(|_| ErrorCode::InvalidAccountData)?
            );
            let virtual_sol_reserves = u64::from_le_bytes(
                bonding_curve_data[16..24].try_into().map_err(|_| ErrorCode::InvalidAccountData)?
            );

            // Validate reserves are not zero (sanity check)
            require!(
                virtual_token_reserves > 0 && virtual_sol_reserves > 0,
                ErrorCode::InvalidAccountData
            );

            // Constant product AMM formula: k = virtual_token_reserves * virtual_sol_reserves
            // After buy: (vSOL + SOL_in) * (vTOKEN - TOKEN_out) = k
            // TOKEN_out = vTOKEN - (k / (vSOL + SOL_in))
            let k = (virtual_token_reserves as u128)
                .checked_mul(virtual_sol_reserves as u128)
                .ok_or(ErrorCode::MathError)?;

            let new_virtual_sol_reserves = (virtual_sol_reserves as u128)
                .checked_add(net_amount_for_token as u128)
                .ok_or(ErrorCode::MathError)?;

            let new_virtual_token_reserves = k
                .checked_div(new_virtual_sol_reserves)
                .ok_or(ErrorCode::MathError)?;

            let token_amount_exact = (virtual_token_reserves as u128)
                .checked_sub(new_virtual_token_reserves)
                .ok_or(ErrorCode::MathError)? as u64;

            // Apply 1% slippage buffer to account for rounding and ensure transaction succeeds
            // This guarantees we don't request more tokens than our SOL can buy
            let token_amount = (token_amount_exact as u128)
                .checked_mul(99)
                .ok_or(ErrorCode::MathError)?
                .checked_div(100)
                .ok_or(ErrorCode::MathError)? as u64;

            // msg!("Bonding curve calculation: {} lamports SOL -> {} tokens (exact: {}, with 1% slippage)",
            //      net_amount_for_token, token_amount, token_amount_exact);

            // Build buy instruction manually with CORRECT discriminator from IDL
            // Discriminator = [102, 6, 61, 18, 1, 218, 235, 234] (from pump.json IDL)
            let buy_discriminator: [u8; 8] = [102, 6, 61, 18, 1, 218, 235, 234];

            // Instruction data: [discriminator(8), token_amount(8), max_sol_cost(8), track_volume(1)]
            // CRITICAL FIX: Parameter 1 = TOKEN AMOUNT (6 decimals), NOT SOL!
            // Parameter 2 = MAX SOL COST (lamports cap)
            // track_volume is OptionBool: 1 byte (0x00 = None, 0x01 = Some(false), 0x02 = Some(true))
            let mut instruction_data = Vec::with_capacity(25);
            instruction_data.extend_from_slice(&buy_discriminator);
            instruction_data.extend_from_slice(&token_amount.to_le_bytes()); // TOKEN amount (FIX!)
            instruction_data.extend_from_slice(&net_amount_for_token.to_le_bytes()); // Max SOL cost
            instruction_data.push(0x00); // track_volume = None (skip volume tracking to reduce tx size)

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
                // 8. token_program (readonly) - Token2022 (Pump.fun uses Token2022)
                AccountMeta::new_readonly(ctx.accounts.token_2022_program.key(), false),
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
                    ctx.accounts.token_2022_program.to_account_info(), // Token2022 program (Pump.fun tokens)
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

            // Validate token account ownership and mint
            require!(
                market_token_acct.owner == market.key(),
                ErrorCode::Unauthorized
            );
            require!(
                market_token_acct.mint == ctx.accounts.token_mint.key(),
                ErrorCode::Unauthorized
            );

            let total_tokens = market_token_acct.amount;

            // -------------------------
            // Now transfer completion fee (AFTER CPI completes)
            // -------------------------
            // Market vault holds all SOL, transfer fee from vault to treasury
            // Use system_program::transfer with invoke_signed (vault is system-owned)
            let market_key = market.key();
            let vault_seeds = &[
                b"market_vault",
                market_key.as_ref(),
                &[ctx.bumps.market_vault],
            ];
            let signer_seeds = &[&vault_seeds[..]];

            anchor_lang::system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.market_vault.to_account_info(),
                        to: treasury.to_account_info(),
                    },
                    signer_seeds,
                ),
                completion_fee,
            )?;

            // Update treasury total fees
            treasury.total_fees = treasury
                .total_fees
                .checked_add(completion_fee)
                .ok_or(ErrorCode::MathError)?;

            // -------------------------
            // Handle excess SOL if any (transfer to market account for founder vesting)
            // -------------------------
            if excess_sol > 0 {
                // Calculate founder's immediate (8%) and vesting (92%) portions
                let _founder_immediate_sol = (excess_sol * FOUNDER_IMMEDIATE_SHARE_BPS) / BPS_DIVISOR;
                let _founder_vesting_sol = excess_sol
                    .checked_sub(_founder_immediate_sol)
                    .ok_or(ErrorCode::MathError)?;

                // Transfer excess SOL from vault to market account
                // Market account will hold the SOL for founder vesting claims
                let market_key = market.key();
                let vault_seeds = &[
                    b"market_vault",
                    market_key.as_ref(),
                    &[ctx.bumps.market_vault],
                ];
                let signer_seeds = &[&vault_seeds[..]];

                anchor_lang::system_program::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.market_vault.to_account_info(),
                            to: market.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    excess_sol,
                )?;

                // Store allocation in market state
                market.founder_excess_sol_allocated = excess_sol;
                market.founder_vesting_initialized = false; // Will be initialized in separate instruction

                // msg!("💰 Excess SOL allocated to founder vesting:");
                // msg!("   Total excess: {} lamports", excess_sol);
                // msg!("   Immediate (8%): {} lamports", _founder_immediate_sol);
                // msg!("   Vesting (92%): {} lamports over 12 months", _founder_vesting_sol);
            }

            // Set token mint in market state
            market.token_mint = Some(ctx.accounts.token_mint.key());

            // Update pool balance to rent-exempt amount (reserved for vault account)
            // Total spent from vault: net_amount_for_token + completion_fee + excess_sol (if any)
            // Remaining in vault: vault_rent_exempt
            market.pool_balance = vault_rent_exempt;

            // -------------------------
            // Calculate token distribution (65% / 33% / 2%)
            // -------------------------

            let platform_tokens = (total_tokens * PLATFORM_TOKEN_SHARE_BPS) / BPS_DIVISOR;
            let team_tokens = (total_tokens * TEAM_TOKEN_SHARE_BPS) / BPS_DIVISOR;
            let yes_voter_tokens = total_tokens
                .checked_sub(platform_tokens)
                .and_then(|v| v.checked_sub(team_tokens))
                .ok_or(ErrorCode::MathError)?;

            // Store token allocations
            market.platform_tokens_allocated = platform_tokens;
            market.yes_voter_tokens_allocated = yes_voter_tokens;

        }

        MarketResolution::NoWins => {
            // Use vault's ACTUAL lamport balance (same as YesWins case)
            let vault_lamports = ctx.accounts.market_vault.lamports();

            // Deduct 5% completion fee from actual vault balance
            let completion_fee = (vault_lamports * COMPLETION_FEE_BPS) / BPS_DIVISOR;

            // Transfer fee from market vault to treasury
            // Use system_program::transfer with invoke_signed (vault is system-owned)
            let market_key = market.key();
            let vault_seeds = &[
                b"market_vault",
                market_key.as_ref(),
                &[ctx.bumps.market_vault],
            ];
            let signer_seeds = &[&vault_seeds[..]];

            anchor_lang::system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.market_vault.to_account_info(),
                        to: treasury.to_account_info(),
                    },
                    signer_seeds,
                ),
                completion_fee,
            )?;

            // Update treasury total fees
            treasury.total_fees = treasury
                .total_fees
                .checked_add(completion_fee)
                .ok_or(ErrorCode::MathError)?;

            // Calculate remaining vault balance for distribution
            let distribution_amount = vault_lamports
                .checked_sub(completion_fee)
                .ok_or(ErrorCode::MathError)?;

            // Transfer remaining SOL from vault to market account for distribution
            // NO voters will claim from market account (not vault)
            anchor_lang::system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.market_vault.to_account_info(),
                        to: market.to_account_info(),
                    },
                    signer_seeds,
                ),
                distribution_amount,
            )?;

            // Update market pool balance (95% of vault now in market account)
            market.pool_balance = distribution_amount;

            // Set distribution pool (snapshot for proportional claims)
            // This ensures all NO voters claim from the same fixed pool
            market.distribution_pool = market.pool_balance;

        }

        MarketResolution::Refund => {
            // No fees deducted for refunds
            // Transfer all vault SOL to market account for user refunds
            let vault_lamports = ctx.accounts.market_vault.lamports();

            // Keep minimum rent-exempt balance in vault
            let rent = Rent::get()?;
            let vault_rent_exempt = rent.minimum_balance(0);

            // Transfer everything except rent-exempt to market account
            let refund_pool = vault_lamports
                .checked_sub(vault_rent_exempt)
                .ok_or(ErrorCode::MathError)?;

            if refund_pool > 0 {
                let market_key = market.key();
                let vault_seeds = &[
                    b"market_vault",
                    market_key.as_ref(),
                    &[ctx.bumps.market_vault],
                ];
                let signer_seeds = &[&vault_seeds[..]];

                anchor_lang::system_program::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.market_vault.to_account_info(),
                            to: market.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    refund_pool,
                )?;

                // Update market pool balance for refunds
                market.pool_balance = refund_pool;
            }
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

    Ok(())
}
