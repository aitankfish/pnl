use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::ErrorCode;
use crate::state::*;

/// Claim rewards after market resolution
///
/// Handles three scenarios:
/// 1. YesWins: YES voters receive proportional tokens (65% allocation)
/// 2. NoWins: NO voters receive proportional SOL from pool
/// 3. Refund: All participants receive refund (invested - trading fees)
///
/// Each user can only claim once (position.claimed flag)
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        constraint = market.resolution != MarketResolution::Unresolved @ ErrorCode::InvalidResolutionState
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.market == market.key() @ ErrorCode::Unauthorized,
        constraint = position.user == user.key() @ ErrorCode::Unauthorized,
        constraint = !position.claimed @ ErrorCode::AlreadyClaimed,
        close = user  // 🔥 Close account and send rent to user
    )]
    pub position: Account<'info, Position>,

    /// Market's token account (for YES wins only)
    /// CHECK: Validated when resolution == YesWins
    #[account(mut)]
    pub market_token_account: UncheckedAccount<'info>,

    /// User's token account (for YES wins only)
    /// CHECK: Validated when resolution == YesWins
    #[account(mut)]
    pub user_token_account: UncheckedAccount<'info>,

    /// User claiming rewards
    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Only used for YES wins token transfers
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<ClaimRewards>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    // -------------------------
    // Process claim based on resolution
    // -------------------------

    match market.resolution {
        MarketResolution::YesWins => {
            // YES voters receive tokens (proportional to yes_shares out of 65% allocation)
            require!(position.yes_shares > 0, ErrorCode::InsufficientBalance);
            require!(market.total_yes_shares > 0, ErrorCode::MathError);
            require!(market.yes_voter_tokens_allocated > 0, ErrorCode::InsufficientBalance);

            // Calculate user's proportional token claim
            // user_tokens = (user_yes_shares / total_yes_shares) * yes_voter_tokens_allocated
            let user_tokens = ((position.yes_shares as u128 * market.yes_voter_tokens_allocated as u128)
                / market.total_yes_shares as u128) as u64;

            require!(user_tokens > 0, ErrorCode::InsufficientBalance);

            // -------------------------
            // Transfer tokens from market to user
            // -------------------------

            // Deserialize token accounts for validation
            let market_token_acct = TokenAccount::try_deserialize(
                &mut &ctx.accounts.market_token_account.try_borrow_data()?[..]
            )?;
            let user_token_acct = TokenAccount::try_deserialize(
                &mut &ctx.accounts.user_token_account.try_borrow_data()?[..]
            )?;

            // Validate token accounts
            require!(
                market_token_acct.owner == market.key(),
                ErrorCode::Unauthorized
            );
            require!(
                user_token_acct.owner == ctx.accounts.user.key(),
                ErrorCode::Unauthorized
            );
            require!(
                market_token_acct.mint == market.token_mint.unwrap(),
                ErrorCode::Unauthorized
            );
            require!(
                user_token_acct.mint == market.token_mint.unwrap(),
                ErrorCode::Unauthorized
            );

            // Create PDA signer seeds for market
            let founder_key = market.founder;
            let ipfs_hash = anchor_lang::solana_program::hash::hash(market.ipfs_cid.as_bytes());
            let market_seeds = &[
                b"market",
                founder_key.as_ref(),
                ipfs_hash.as_ref(),
                &[market.bump],
            ];
            let signer_seeds = &[&market_seeds[..]];

            // Transfer tokens via CPI
            let transfer_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.market_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: market.to_account_info(),
                },
                signer_seeds,
            );

            token::transfer(transfer_ctx, user_tokens)?;
        }

        MarketResolution::NoWins => {
            // NO voters receive SOL (proportional to no_shares)
            require!(position.no_shares > 0, ErrorCode::InsufficientBalance);
            require!(market.total_no_shares > 0, ErrorCode::MathError);
            require!(market.distribution_pool > 0, ErrorCode::InsufficientBalance);

            // Calculate proportional payout using fixed distribution pool
            // payout = (user_no_shares / total_no_shares) * distribution_pool
            // This ensures fair distribution regardless of claim order
            let user_payout = ((position.no_shares as u128 * market.distribution_pool as u128)
                / market.total_no_shares as u128) as u64;

            require!(user_payout > 0, ErrorCode::InsufficientBalance);

            // Ensure we don't over-distribute (defensive check)
            let market_balance = market.to_account_info().lamports();
            require!(user_payout <= market_balance, ErrorCode::InsufficientBalance);

            // Transfer SOL from market account to user
            **market.to_account_info().try_borrow_mut_lamports()? -= user_payout;
            **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += user_payout;

            // Update market pool balance (tracks actual remaining SOL)
            market.pool_balance = market
                .pool_balance
                .checked_sub(user_payout)
                .ok_or(ErrorCode::MathError)?;
        }

        MarketResolution::Refund => {
            // Refund invested amount minus trading fees (98.5% of invested)
            // Trading fees (1.5%) were already paid to treasury during trades
            use crate::constants::{TRADE_FEE_BPS, BPS_DIVISOR};

            let total_invested = position.total_invested;
            require!(total_invested > 0, ErrorCode::InsufficientBalance);

            // Calculate net refund: invested - trading_fees
            // refund_amount = total_invested * (10000 - 150) / 10000 = 98.5% of invested
            let refund_amount = (total_invested as u128 * (BPS_DIVISOR - TRADE_FEE_BPS) as u128
                / BPS_DIVISOR as u128) as u64;

            require!(refund_amount > 0, ErrorCode::InsufficientBalance);

            // Ensure market has enough balance
            let market_balance = market.to_account_info().lamports();
            require!(refund_amount <= market_balance, ErrorCode::InsufficientBalance);

            // Transfer refund from market account to user
            **market.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
            **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += refund_amount;

            // Update market pool balance
            market.pool_balance = market
                .pool_balance
                .checked_sub(refund_amount)
                .ok_or(ErrorCode::MathError)?;
        }

        MarketResolution::Unresolved => {
            // Market not yet resolved
            return Err(ErrorCode::InvalidResolutionState.into());
        }
    }

    // -------------------------
    // Mark position as claimed
    // -------------------------

    position.claimed = true;

    // -------------------------
    // 🔥 RENT RECOVERY: Position PDA will be closed automatically
    // -------------------------
    // The `close = user` constraint in the account struct will:
    // 1. Zero out the position account data
    // 2. Transfer all lamports (rent) to the user
    // 3. Mark account for garbage collection
    //
    // This happens AFTER this function returns, handled by Anchor framework

    Ok(())
}
