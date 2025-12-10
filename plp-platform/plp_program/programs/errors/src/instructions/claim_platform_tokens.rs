use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenAccount, TokenInterface, TransferChecked};
use crate::constants::PNL_WALLET;
use crate::errors::ErrorCode;
use crate::state::*;
use std::str::FromStr;

/// Claim platform's 2% token allocation (immediate, no vesting)
///
/// Transfers tokens to hardcoded P&L wallet: 3MihVtsLsVuEccpmz4YG72Cr8CJWf1evRorTPdPiHeEQ
/// Can only be called once after token launch
#[derive(Accounts)]
pub struct ClaimPlatformTokens<'info> {
    #[account(
        mut,
        constraint = market.token_mint.is_some() @ ErrorCode::InvalidResolutionState,
        constraint = !market.platform_tokens_claimed @ ErrorCode::AlreadyClaimed
    )]
    pub market: Account<'info, Market>,

    /// Market's token account (holds platform tokens)
    #[account(
        mut,
        constraint = market_token_account.owner == market.key() @ ErrorCode::Unauthorized,
        constraint = market_token_account.mint == market.token_mint.unwrap() @ ErrorCode::Unauthorized
    )]
    pub market_token_account: InterfaceAccount<'info, TokenAccount>,

    /// P&L Platform wallet's token account (receives 2% allocation)
    #[account(
        mut,
        constraint = pnl_token_account.owner == Pubkey::from_str(PNL_WALLET).unwrap() @ ErrorCode::Unauthorized,
        constraint = pnl_token_account.mint == market.token_mint.unwrap() @ ErrorCode::Unauthorized
    )]
    pub pnl_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Token mint account
    /// CHECK: Validated via token account constraints
    pub token_mint: UncheckedAccount<'info>,

    /// Can be called by anyone (tokens always go to P&L wallet)
    #[account(mut)]
    pub caller: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ClaimPlatformTokens>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    // Ensure tokens have been allocated
    require!(
        market.platform_tokens_allocated > 0,
        ErrorCode::InsufficientBalance
    );

    // -------------------------
    // Transfer tokens from market to P&L wallet
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
            to: ctx.accounts.pnl_token_account.to_account_info(),
            authority: market.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
        },
        signer_seeds,
    );

    token_interface::transfer_checked(transfer_ctx, market.platform_tokens_allocated, 6)?; // Pump.fun tokens use 6 decimals

    // -------------------------
    // Mark as claimed
    // -------------------------

    market.platform_tokens_claimed = true;

    Ok(())
}
