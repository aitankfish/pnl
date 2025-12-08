use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Migrate existing market to use Market Vault PDA
///
/// This instruction is needed for markets created before the vault system was implemented.
/// It creates the market_vault PDA and transfers any SOL from the market account to the vault.
///
/// Can be called by anyone (idempotent - safe to call multiple times)
#[derive(Accounts)]
pub struct MigrateMarket<'info> {
    /// Existing market account (may contain SOL from old buy_yes/buy_no calls)
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// Market Vault PDA (will be created if doesn't exist)
    /// CHECK: Validated and initialized in handler
    #[account(mut)]
    pub market_vault: UncheckedAccount<'info>,

    /// Payer for vault creation rent (if needed)
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MigrateMarket>) -> Result<()> {
    let market = &ctx.accounts.market;
    let market_key = market.key();

    // -------------------------
    // 1) Validate vault PDA derivation
    // -------------------------

    let (vault_pda, vault_bump) = Pubkey::find_program_address(
        &[b"market_vault", market_key.as_ref()],
        ctx.program_id
    );

    require!(
        ctx.accounts.market_vault.key() == vault_pda,
        ErrorCode::Unauthorized
    );

    // -------------------------
    // 2) Check if vault already exists
    // -------------------------

    let vault_account_info = ctx.accounts.market_vault.to_account_info();
    let vault_exists = vault_account_info.owner != &System::id() || vault_account_info.lamports() > 0;

    if vault_exists {
        msg!("⚠️  Market vault already exists - migration already completed");
        msg!("   Market: {}", market_key);
        msg!("   Vault: {}", vault_pda);
        msg!("   Vault balance: {} lamports", vault_account_info.lamports());
        return Ok(());
    }

    msg!("🔄 MIGRATING MARKET TO VAULT SYSTEM");
    msg!("   Market: {}", market_key);
    msg!("   Vault PDA: {}", vault_pda);

    // -------------------------
    // 3) Create vault account
    // -------------------------

    let rent = Rent::get()?;
    let vault_rent_lamports = rent.minimum_balance(0);

    anchor_lang::system_program::create_account(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.market_vault.to_account_info(),
            },
        ),
        vault_rent_lamports,
        0, // No data
        ctx.program_id,
    )?;

    msg!("✅ Vault created with rent: {} lamports", vault_rent_lamports);

    // -------------------------
    // 4) Transfer SOL from market to vault (if any)
    // -------------------------

    // Get market's current balance (excluding rent-exempt minimum)
    let market_account_info = ctx.accounts.market.to_account_info();
    let market_balance = market_account_info.lamports();
    let market_rent_exempt = rent.minimum_balance(Market::SPACE);

    // Calculate transferable amount (total balance - rent reserve)
    // This represents SOL from old buy_yes/buy_no calls
    let transferable = market_balance.saturating_sub(market_rent_exempt);

    if transferable > 0 {
        msg!("💰 Transferring {} lamports from market to vault", transferable);
        msg!("   Market balance: {} lamports", market_balance);
        msg!("   Market rent reserve: {} lamports", market_rent_exempt);

        // Use direct lamport manipulation to bypass System Program's
        // "Transfer: from must not carry data" restriction
        **market_account_info.try_borrow_mut_lamports()? -= transferable;
        **vault_account_info.try_borrow_mut_lamports()? += transferable;

        msg!("✅ SOL transferred to vault");
    } else {
        msg!("ℹ️  No SOL to transfer (market only has rent-exempt minimum)");
    }

    // -------------------------
    // 5) Verify final state
    // -------------------------

    let final_vault_balance = vault_account_info.lamports();
    let final_market_balance = market_account_info.lamports();

    msg!("✅ MIGRATION COMPLETE");
    msg!("   Final vault balance: {} lamports", final_vault_balance);
    msg!("   Final market balance: {} lamports (rent reserve)", final_market_balance);
    msg!("   Market can now use buy_yes/buy_no/resolve_market with vault");

    Ok(())
}
