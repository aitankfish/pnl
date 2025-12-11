use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Initialize founder SOL vesting schedule after YES wins with excess pool
///
/// Must be called after resolve_market when:
/// - market.resolution == YesWins
/// - market.founder_excess_sol_allocated > 0 (pool was > 50 SOL)
/// Sets up 12-month linear vesting for founder's excess SOL (8% immediate + 92% vested)
#[derive(Accounts)]
pub struct InitFounderVesting<'info> {
    #[account(
        mut,
        constraint = market.resolution == MarketResolution::YesWins @ ErrorCode::InvalidResolutionState,
        constraint = market.founder_excess_sol_allocated > 0 @ ErrorCode::NoExcessSol,
        constraint = !market.founder_vesting_initialized @ ErrorCode::AlreadyInitialized
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = founder,
        space = FounderVesting::SPACE,
        seeds = [b"founder_vesting", market.key().as_ref()],
        bump
    )]
    pub founder_vesting: Account<'info, FounderVesting>,

    /// Founder wallet (must be the market founder)
    #[account(
        mut,
        constraint = founder.key() == market.founder @ ErrorCode::Unauthorized
    )]
    pub founder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitFounderVesting>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let founder_vesting = &mut ctx.accounts.founder_vesting;

    let total_excess = market.founder_excess_sol_allocated;
    let immediate_sol = (total_excess * FOUNDER_IMMEDIATE_SHARE_BPS) / BPS_DIVISOR;
    let vesting_sol = total_excess
        .checked_sub(immediate_sol)
        .ok_or(ErrorCode::MathError)?;

    require!(total_excess > 0, ErrorCode::NoExcessSol);
    require!(immediate_sol > 0, ErrorCode::MathError);
    require!(vesting_sol > 0, ErrorCode::MathError);

    // -------------------------
    // Initialize vesting schedule
    // -------------------------

    let current_time = Clock::get()?.unix_timestamp;

    founder_vesting.market = market.key();
    founder_vesting.founder = market.founder;
    founder_vesting.total_sol = total_excess;
    founder_vesting.immediate_sol = immediate_sol;
    founder_vesting.vesting_sol = vesting_sol;
    founder_vesting.claimed_sol = 0;
    founder_vesting.immediate_claimed = false;
    founder_vesting.vesting_start = current_time;
    founder_vesting.vesting_duration = FounderVesting::VESTING_DURATION_SECONDS;
    founder_vesting.bump = ctx.bumps.founder_vesting;

    // Mark as initialized in market state
    market.founder_vesting_initialized = true;

    msg!("✅ Founder SOL vesting initialized");
    msg!("   Total excess: {} lamports", total_excess);
    msg!("   Immediate (8%): {} lamports", immediate_sol);
    msg!("   Vesting (92%): {} lamports over 12 months", vesting_sol);

    Ok(())
}
