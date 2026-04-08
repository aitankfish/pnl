use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Close a position account and recover rent
///
/// This instruction allows users to close their position account and recover the rent
/// in cases where they haven't claimed yet, such as:
/// 1. Market is in Refund state and they want to close without claiming
/// 2. Position has 0 shares (closed position from previous claim)
/// 3. User wants to clean up old accounts
///
/// Requirements:
/// - Position must belong to the signer
/// - Position must be claimed already (rewards already received)
///   OR market must be in Refund state
///
/// Result: Position PDA closed, rent refunded to user
#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(
        constraint = position.market == market.key() @ ErrorCode::Unauthorized
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.user == user.key() @ ErrorCode::Unauthorized,
        close = user  // 🔥 Close account and send rent to user
    )]
    pub position: Account<'info, Position>,

    /// User closing the position
    #[account(mut)]
    pub user: Signer<'info>,
}

pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    let position = &ctx.accounts.position;
    let market = &ctx.accounts.market;

    // Verify position can be closed
    // Allow closing if:
    // 1. Position already claimed (rewards received)
    // 2. OR market is in Refund state (can close without claiming)
    require!(
        position.claimed || market.resolution == MarketResolution::Refund,
        ErrorCode::CannotClosePosition
    );

    msg!("🗑️  Closing position account");
    msg!("   User: {}", ctx.accounts.user.key());
    msg!("   Market: {}", market.key());
    msg!("   Claimed: {}", position.claimed);
    msg!("   Resolution: {:?}", market.resolution);

    // Anchor's `close` constraint will automatically:
    // - Zero out account data
    // - Transfer rent to user
    // - Mark account for garbage collection

    msg!("💰 Position closed - rent recovered");

    Ok(())
}
