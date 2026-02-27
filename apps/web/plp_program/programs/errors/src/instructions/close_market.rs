use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Close a market account and recover rent
///
/// This instruction allows the founder to close their market account after:
/// 1. Market has been resolved
/// 2. Sufficient time has passed for all users to claim (e.g., 30 days after expiry)
/// 3. Pool balance is zero (all rewards distributed)
///
/// This is an optional cleanup operation that:
/// - Recovers the market PDA rent (~0.01 SOL) for the founder
/// - Removes the market from on-chain storage
/// - Keeps the blockchain clean
///
/// Requirements:
/// - Market must be resolved (not Unresolved)
/// - Must be past claim period (expiry_time + 30 days)
/// - Pool balance must be 0 (or very small dust amount)
/// - Only founder can close
///
/// Result: Market PDA closed, rent refunded to founder
#[derive(Accounts)]
pub struct CloseMarket<'info> {
    #[account(
        mut,
        constraint = market.founder == founder.key() @ ErrorCode::Unauthorized,
        constraint = market.resolution != MarketResolution::Unresolved @ ErrorCode::InvalidResolutionState,
        close = founder  // 🔥 Close account and send rent to founder
    )]
    pub market: Account<'info, Market>,

    /// Founder who created the market
    #[account(mut)]
    pub founder: Signer<'info>,
}

pub fn handler(ctx: Context<CloseMarket>) -> Result<()> {
    let market = &ctx.accounts.market;
    let clock = Clock::get()?;

    // Claim period: 30 days (2,592,000 seconds)
    const CLAIM_PERIOD: i64 = 30 * 24 * 60 * 60;

    // Check if claim period has passed
    let claim_deadline = market.expiry_time + CLAIM_PERIOD;
    require!(
        clock.unix_timestamp > claim_deadline,
        ErrorCode::ClaimPeriodNotOver
    );

    // Check if pool is nearly empty
    // Allow small dust from rounding errors or unclaimed positions
    // Threshold: 0.01 SOL - enough for rounding but prevents closing with significant funds
    const DUST_THRESHOLD: u64 = 10_000_000; // 0.01 SOL
    require!(
        market.pool_balance <= DUST_THRESHOLD,
        ErrorCode::PoolNotEmpty
    );

    // If there's any leftover dust in the pool, transfer it to founder
    // This handles rounding errors and unclaimed small amounts
    if market.pool_balance > 0 {
        let dust_amount = market.pool_balance;
        **market.to_account_info().try_borrow_mut_lamports()? -= dust_amount;
        **ctx.accounts.founder.to_account_info().try_borrow_mut_lamports()? += dust_amount;
        // msg!("   Dust transferred to founder: {} lamports ({} SOL)",
        //      dust_amount,
        //      dust_amount as f64 / 1_000_000_000.0);
    }

    // msg!("🗑️  Closing market account");
    // msg!("   Founder: {}", ctx.accounts.founder.key());
    // msg!("   Market: {}", market.key());
    // msg!("   IPFS CID: {}", market.ipfs_cid);
    // msg!("   Resolution: {:?}", market.resolution);
    // msg!("   Pool Balance before close: {} lamports", market.pool_balance);
    // msg!("   Expiry: {}", market.expiry_time);
    // msg!("   Claim Deadline: {}", claim_deadline);
    // msg!("   Current Time: {}", clock.unix_timestamp);

    // Anchor's `close` constraint will automatically:
    // - Zero out account data
    // - Transfer rent (~0.004 SOL) to founder
    // - Mark account for garbage collection

    // msg!("💰 Market closed - rent + dust recovered by founder");

    Ok(())
}
