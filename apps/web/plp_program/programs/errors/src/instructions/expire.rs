use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::Market;

/// Anyone can call this once the market has passed its expiry timestamp.
/// It freezes the market so no further buys are allowed and moves it to the
/// "Expired" phase, after which the creator can finalize_yes/finalize_no
/// or users can refund if the target wasn’t reached.
#[derive(Accounts)]
pub struct Expire<'info> {
    #[account(
        mut,
        constraint = market.state == 0 @ ErrorCode::AlreadyFinalized  // 0 = Active
    )]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<Expire>) -> Result<()> {
    let m = &mut ctx.accounts.market;

    // Must be at/after expiry
    let now = Clock::get()?.unix_timestamp;
    require!(now >= m.expiry_ts, ErrorCode::TooEarly);

    // Move to Expired state (1 = Expired, 2 = Finalized handled later)
    m.state = 1;

    // Optional: log whether target was met to guide next step on the frontend
    let target_met = m.total_sol_in >= m.target_lamports;
    if target_met {
        msg!("⏰ Market expired — target met. Next: finalize_yes/finalize_no.");
    } else {
        msg!("⏰ Market expired — target NOT met. Next: refunds are allowed.");
    }

    Ok(())
}
