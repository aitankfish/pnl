use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::Treasury;

/// Allows the admin (founder) to withdraw platform fees from Treasury PDA.
#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump,
        constraint = treasury.admin == admin.key() @ ErrorCode::Unauthorized
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: SOL recipient wallet (can be admin or another)
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;

    // Prevent duplicate mutable account attack
    require!(
        ctx.accounts.recipient.key() != treasury.key(),
        ErrorCode::Unauthorized
    );

    // Ensure sufficient balance
    let treasury_lamports = **treasury.to_account_info().lamports.borrow();
    require!(treasury_lamports >= amount, ErrorCode::InsufficientBalance);

    // Transfer lamports
    **treasury.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx
        .accounts
        .recipient
        .to_account_info()
        .try_borrow_mut_lamports()? += amount;

    treasury.total_fees = treasury.total_fees.saturating_sub(amount);

    msg!(
        "💸 Withdrawn {} lamports to {}",
        amount,
        ctx.accounts.recipient.key()
    );
    Ok(())
}
