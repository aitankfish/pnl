use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::Treasury;

/// Allows the current admin to assign a new admin wallet.
#[derive(Accounts)]
pub struct SetAdmin<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump,
        constraint = treasury.admin == current_admin.key() @ ErrorCode::Unauthorized
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub current_admin: Signer<'info>, // must be the current admin
}

pub fn handler(ctx: Context<SetAdmin>, new_admin: Pubkey) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    let old_admin = treasury.admin;
    treasury.admin = new_admin;

    msg!("👑 Admin changed from {} to {}", old_admin, new_admin);
    Ok(())
}
