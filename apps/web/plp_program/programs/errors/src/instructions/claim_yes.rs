use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Claim tokens when YES is the winner.
/// (v1 stub) — just marks `claimed_yes = true`.
#[derive(Accounts)]
pub struct ClaimYes<'info> {
    #[account(
        mut,
        constraint = market.state == 2 @ ErrorCode::TooEarly, // 2 = Finalized
        constraint = market.winner == Some(true) @ ErrorCode::WrongWinner,
        constraint = market.finalized_yes == true @ ErrorCode::WrongWinner
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = position.market == market.key() @ ErrorCode::Unauthorized,
        constraint = position.user == user.key() @ ErrorCode::Unauthorized,
        constraint = !position.claimed_yes @ ErrorCode::AlreadyClaimed
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<ClaimYes>) -> Result<()> {
    let _m = &ctx.accounts.market;
    let p = &mut ctx.accounts.position;

    // Must actually have YES shares
    require!(p.yes_qty > 0.0, ErrorCode::InsufficientBalance);

    // (v1) No token movement yet — just mark entitlement as claimed
    p.claimed_yes = true;

    msg!("🎫 YES-claim recorded for {}", p.user);
    Ok(())
}
