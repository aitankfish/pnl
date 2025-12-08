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

    let (vault_pda, _vault_bump) = Pubkey::find_program_address(
        &[b"market_vault", market_key.as_ref()],
        ctx.program_id
    );

    require!(
        ctx.accounts.market_vault.key() == vault_pda,
        ErrorCode::Unauthorized
    );

    let vault_account_info = ctx.accounts.market_vault.to_account_info();
    let vault_exists = vault_account_info.owner != &System::id() || vault_account_info.lamports() > 0;

    if vault_exists {
        return Ok(());
    }

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
        0,
        ctx.program_id,
    )?;

    let market_account_info = ctx.accounts.market.to_account_info();
    let market_balance = market_account_info.lamports();
    let market_rent_exempt = rent.minimum_balance(Market::SPACE);
    let transferable = market_balance.saturating_sub(market_rent_exempt);

    if transferable > 0 {
        **market_account_info.try_borrow_mut_lamports()? -= transferable;
        **vault_account_info.try_borrow_mut_lamports()? += transferable;
    }

    msg!("Market vault migration complete");

    Ok(())
}
