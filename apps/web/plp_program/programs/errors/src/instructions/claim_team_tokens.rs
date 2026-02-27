use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenAccount, TokenInterface, TransferChecked};
use crate::errors::ErrorCode;
use crate::state::*;

/// Claim vested team tokens
///
/// Allows the team to claim tokens based on linear vesting schedule (12 months)
/// Can be called multiple times to claim unlocked tokens
#[derive(Accounts)]
pub struct ClaimTeamTokens<'info> {
    #[account(
        mut,
        constraint = team_vesting.market == market.key() @ ErrorCode::Unauthorized
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"team_vesting", market.key().as_ref()],
        bump = team_vesting.bump,
        constraint = team_vesting.team_wallet == team_wallet.key() @ ErrorCode::Unauthorized
    )]
    pub team_vesting: Account<'info, TeamVesting>,

    /// Market's token account (holds team tokens)
    #[account(
        mut,
        constraint = market_token_account.owner == market.key() @ ErrorCode::Unauthorized,
        constraint = market_token_account.mint == team_vesting.token_mint @ ErrorCode::Unauthorized
    )]
    pub market_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Team's token account (receives vested tokens)
    #[account(
        mut,
        constraint = team_token_account.owner == team_wallet.key() @ ErrorCode::Unauthorized,
        constraint = team_token_account.mint == team_vesting.token_mint @ ErrorCode::Unauthorized
    )]
    pub team_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Team wallet claiming tokens
    #[account(mut)]
    pub team_wallet: Signer<'info>,

    /// Token mint account
    /// CHECK: Validated via token account constraints
    pub token_mint: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ClaimTeamTokens>) -> Result<()> {
    let team_vesting = &mut ctx.accounts.team_vesting;
    let market = &ctx.accounts.market;

    // -------------------------
    // 1) Calculate claimable tokens
    // -------------------------

    let current_time = Clock::get()?.unix_timestamp;
    let claimable = team_vesting.calculate_claimable_tokens(current_time)?;

    require!(claimable > 0, ErrorCode::InsufficientBalance);

    // -------------------------
    // 2) Transfer tokens from market to team
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

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.market_token_account.to_account_info(),
            to: ctx.accounts.team_token_account.to_account_info(),
            authority: market.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
        },
        signer_seeds,
    );

    token_interface::transfer_checked(transfer_ctx, claimable, 6)?; // Pump.fun tokens use 6 decimals

    // -------------------------
    // 3) Update claimed amount
    // -------------------------

    // Track if this claim includes immediate tokens
    let includes_immediate = !team_vesting.immediate_claimed && team_vesting.immediate_tokens > 0;

    // Mark immediate as claimed if applicable
    if includes_immediate {
        team_vesting.immediate_claimed = true;
    }

    team_vesting.claimed_tokens = team_vesting
        .claimed_tokens
        .checked_add(claimable)
        .ok_or(ErrorCode::MathError)?;

    // msg!("✅ TEAM TOKENS CLAIMED");
    // msg!("   Team wallet: {}", ctx.accounts.team_wallet.key());
    // msg!("   Claimed: {} tokens", claimable);
    // if includes_immediate {
    //     msg!("   └─ Immediate (5%): {} tokens", team_vesting.immediate_tokens);
    //     msg!("   └─ Vested: {} tokens", claimable - team_vesting.immediate_tokens);
    // }
    // msg!("   Total claimed: {} / {}", team_vesting.claimed_tokens, team_vesting.total_tokens);
    // msg!("   Vesting progress: {} / {} seconds",
    //     current_time - team_vesting.vesting_start,
    //     team_vesting.vesting_duration
    // );

    Ok(())
}
