use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Extend market for additional funding
///
/// Only callable by founder when:
/// 1. Pool has reached target_pool
/// 2. YES is winning (total_yes_shares > total_no_shares)
/// 3. Market is still in Prediction phase
///
/// After extension:
/// - Market phase changes to Funding
/// - Trading can continue beyond target_pool
/// - Votes are frozen (outcome already determined)
/// - Owner can resolve early or must resolve at expiry
#[derive(Accounts)]
pub struct ExtendMarket<'info> {
    #[account(
        mut,
        constraint = market.founder == founder.key() @ ErrorCode::Unauthorized,
        constraint = market.phase == MarketPhase::Prediction @ ErrorCode::InvalidMarketPhase,
        constraint = market.resolution == MarketResolution::Unresolved @ ErrorCode::AlreadyResolved
    )]
    pub market: Account<'info, Market>,

    /// Market founder (only they can extend)
    #[account(mut)]
    pub founder: Signer<'info>,
}

pub fn handler(ctx: Context<ExtendMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    // -------------------------
    // 1) Validate extension conditions
    // -------------------------

    // Check pool has reached target
    require!(
        market.pool_balance >= market.target_pool,
        ErrorCode::TargetNotReached
    );

    // Check YES is winning (only extend if YES winning)
    require!(
        market.total_yes_shares > market.total_no_shares,
        ErrorCode::YesNotWinning
    );

    // -------------------------
    // 2) Update market to Funding phase
    // -------------------------

    market.phase = MarketPhase::Funding;

    // msg!("✅ MARKET EXTENDED TO FUNDING PHASE");
    // msg!("   Market: {}", market.key());
    // msg!("   Founder: {}", ctx.accounts.founder.key());
    // msg!("   Current pool: {} lamports", market.pool_balance);
    // msg!("   Target pool: {} lamports", market.target_pool);
    // msg!("   YES shares: {}", market.total_yes_shares);
    // msg!("   NO shares: {}", market.total_no_shares);
    // msg!("   Votes are now FROZEN - outcome locked to YES");
    // msg!("   Trading continues for additional funding");

    Ok(())
}
