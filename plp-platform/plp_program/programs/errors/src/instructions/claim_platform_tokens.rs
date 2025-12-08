use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::constants::PNL_WALLET;
use crate::errors::ErrorCode;
use crate::state::*;
use std::str::FromStr;

/// Claim platform's 1% token allocation (immediate, no vesting)
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
    pub market_token_account: Account<'info, TokenAccount>,

    /// P&L Platform wallet's token account (receives 1% allocation)
    #[account(
        mut,
        constraint = pnl_token_account.owner == Pubkey::from_str(PNL_WALLET).unwrap() @ ErrorCode::Unauthorized,
        constraint = pnl_token_account.mint == market.token_mint.unwrap() @ ErrorCode::Unauthorized
    )]
    pub pnl_token_account: Account<'info, TokenAccount>,

    /// Can be called by anyone (tokens always go to P&L wallet)
    #[account(mut)]
    pub caller: Signer<'info>,

    pub token_program: Program<'info, Token>,
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
        Transfer {
            from: ctx.accounts.market_token_account.to_account_info(),
            to: ctx.accounts.pnl_token_account.to_account_info(),
            authority: market.to_account_info(),
        },
        signer_seeds,
    );

    token::transfer(transfer_ctx, market.platform_tokens_allocated)?;

    // -------------------------
    // Mark as claimed
    // -------------------------

    market.platform_tokens_claimed = true;

    msg!("✅ PLATFORM TOKENS CLAIMED");
    msg!("   P&L Wallet: {}", PNL_WALLET);
    msg!("   Amount: {} tokens (2% of supply)", market.platform_tokens_allocated);

    Ok(())
}
