use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Claim vested founder SOL
///
/// Allows the founder to claim excess SOL based on linear vesting schedule (12 months)
/// Can be called multiple times to claim unlocked SOL
#[derive(Accounts)]
pub struct ClaimFounderSol<'info> {
    #[account(
        mut,
        constraint = founder_vesting.market == market.key() @ ErrorCode::Unauthorized
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"founder_vesting", market.key().as_ref()],
        bump = founder_vesting.bump,
        constraint = founder_vesting.founder == founder.key() @ ErrorCode::Unauthorized
    )]
    pub founder_vesting: Account<'info, FounderVesting>,

    /// Founder wallet claiming SOL (must be market founder)
    #[account(
        mut,
        constraint = founder.key() == market.founder @ ErrorCode::Unauthorized
    )]
    pub founder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimFounderSol>) -> Result<()> {
    let founder_vesting = &mut ctx.accounts.founder_vesting;
    let market = &ctx.accounts.market;

    // -------------------------
    // 1) Calculate claimable SOL
    // -------------------------

    let current_time = Clock::get()?.unix_timestamp;
    let claimable = founder_vesting.calculate_claimable_sol(current_time)?;

    require!(claimable > 0, ErrorCode::NothingToClaim);

    // -------------------------
    // 2) Transfer SOL from market to founder
    // -------------------------

    // Create PDA signer seeds for market account
    let founder_key = market.founder;
    let ipfs_hash = anchor_lang::solana_program::hash::hash(market.ipfs_cid.as_bytes());
    let market_seeds = &[
        b"market",
        founder_key.as_ref(),
        ipfs_hash.as_ref(),
        &[market.bump],
    ];
    let signer_seeds = &[&market_seeds[..]];

    // Transfer SOL from market PDA to founder
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: market.to_account_info(),
                to: ctx.accounts.founder.to_account_info(),
            },
            signer_seeds,
        ),
        claimable,
    )?;

    // -------------------------
    // 3) Update claimed amount
    // -------------------------

    // Track if this claim includes immediate SOL
    let includes_immediate = !founder_vesting.immediate_claimed && founder_vesting.immediate_sol > 0;

    // Mark immediate as claimed if applicable
    if includes_immediate {
        founder_vesting.immediate_claimed = true;
    }

    founder_vesting.claimed_sol = founder_vesting
        .claimed_sol
        .checked_add(claimable)
        .ok_or(ErrorCode::MathError)?;

    // msg!("✅ FOUNDER SOL CLAIMED");
    // msg!("   Founder wallet: {}", ctx.accounts.founder.key());
    // msg!("   Claimed: {} lamports", claimable);
    // if includes_immediate {
    //     msg!("   └─ Immediate (8%): {} lamports", founder_vesting.immediate_sol);
    //     msg!("   └─ Vested: {} lamports", claimable - founder_vesting.immediate_sol);
    // }
    // msg!("   Total claimed: {} / {} lamports", founder_vesting.claimed_sol, founder_vesting.total_sol);
    // msg!("   Vesting progress: {} / {} seconds",
    //     current_time - founder_vesting.vesting_start,
    //     founder_vesting.vesting_duration
    // );

    Ok(())
}
