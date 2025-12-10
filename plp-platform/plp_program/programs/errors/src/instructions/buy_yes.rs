use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::ErrorCode;
use crate::state::*;
use crate::utils::amm::*;

/// Buy YES shares with SOL
///
/// Flow:
/// 1. Validate market is active and not expired
/// 2. Validate minimum investment (0.01 SOL)
/// 3. Check one-position rule (user cannot have NO shares)
/// 4. Deduct 1.5% trade fee → treasury
/// 5. Transfer net SOL (98.5%) → market vault
/// 6. Calculate shares using Constant Product AMM (x * y = k)
/// 7. Update position.yes_shares and AMM pools (yes_pool, no_pool)
#[derive(Accounts)]
pub struct BuyYes<'info> {
    #[account(
        mut,
        constraint = market.resolution == MarketResolution::Unresolved @ ErrorCode::AlreadyResolved
    )]
    pub market: Account<'info, Market>,

    /// Market Vault PDA (holds all SOL for the market)
    #[account(
        mut,
        seeds = [b"market_vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = Position::SPACE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = position.user == Pubkey::default() || position.user == user.key() @ ErrorCode::Unauthorized,
        constraint = position.market == Pubkey::default() || position.market == market.key() @ ErrorCode::Unauthorized
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BuyYes>, sol_amount: u64) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    // -------------------------
    // 1) Validation checks
    // -------------------------

    // Check market hasn't expired
    let now = Clock::get()?.unix_timestamp;
    require!(now < market.expiry_time, ErrorCode::MarketExpired);

    // Check minimum investment
    require!(
        sol_amount >= MIN_INVESTMENT_LAMPORTS,
        ErrorCode::InvestmentTooSmall
    );

    // -------------------------
    // Calculate fees and cap amount to remaining pool capacity
    // -------------------------

    let mut actual_sol_amount = sol_amount;
    let mut trade_fee = (actual_sol_amount * TRADE_FEE_BPS) / BPS_DIVISOR;
    let mut net_amount = actual_sol_amount
        .checked_sub(trade_fee)
        .ok_or(ErrorCode::MathError)?;

    // Cap amount to remaining pool capacity in Prediction phase
    // In Funding phase (after extension), trading can continue beyond target
    if market.phase == MarketPhase::Prediction {
        let remaining_capacity = market
            .target_pool
            .checked_sub(market.pool_balance)
            .ok_or(ErrorCode::MathError)?;

        // If net amount exceeds remaining capacity, cap it
        if net_amount > remaining_capacity {
            net_amount = remaining_capacity;

            // Recalculate actual SOL amount needed (reverse the fee calculation)
            // net_amount = sol_amount - fee
            // net_amount = sol_amount - (sol_amount * 1.5 / 100)
            // net_amount = sol_amount * (1 - 0.015)
            // net_amount = sol_amount * 0.985
            // sol_amount = net_amount / 0.985
            // sol_amount = net_amount * 100 / 98.5
            // sol_amount = net_amount * 10000 / 9850
            actual_sol_amount = (net_amount * BPS_DIVISOR) / (BPS_DIVISOR - TRADE_FEE_BPS);
            trade_fee = actual_sol_amount
                .checked_sub(net_amount)
                .ok_or(ErrorCode::MathError)?;

        }
    }

    // One position rule: if user has NO shares, they cannot buy YES
    require!(
        position.no_shares == 0,
        ErrorCode::AlreadyHasPosition
    );

    // -------------------------
    // 2) Transfer fee to treasury
    // -------------------------

    let fee_transfer = system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.treasury.to_account_info(),
    };

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            fee_transfer,
        ),
        trade_fee,
    )?;

    // Update treasury total fees
    ctx.accounts.treasury.total_fees = ctx
        .accounts
        .treasury
        .total_fees
        .checked_add(trade_fee)
        .ok_or(ErrorCode::MathError)?;

    // -------------------------
    // 3) Transfer net amount to market vault (SOL holder)
    // -------------------------

    let net_transfer = system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.market_vault.to_account_info(),
    };

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            net_transfer,
        ),
        net_amount,
    )?;

    // Update market pool balance tracker
    market.pool_balance = market
        .pool_balance
        .checked_add(net_amount)
        .ok_or(ErrorCode::MathError)?;

    // -------------------------
    // 4) Calculate shares using Constant Product AMM
    // -------------------------

    let shares = calculate_shares_from_sol(
        market.yes_pool,
        market.no_pool,
        net_amount,
        true, // buy_yes = true
    )?;

    require!(shares > 0, ErrorCode::MathError);

    // -------------------------
    // 5) Update market and position state
    // -------------------------

    // Update AMM pools
    // When buying YES: YES pool decreases (shares removed), NO pool increases (SOL added)
    market.yes_pool = market
        .yes_pool
        .checked_sub(shares)
        .ok_or(ErrorCode::MathError)?;

    market.no_pool = market
        .no_pool
        .checked_add(net_amount)
        .ok_or(ErrorCode::MathError)?;

    // Track total YES shares distributed (for determining winner at expiry)
    market.total_yes_shares = market
        .total_yes_shares
        .checked_add(shares)
        .ok_or(ErrorCode::MathError)?;

    // Initialize position if needed
    if position.user == Pubkey::default() {
        position.user = ctx.accounts.user.key();
        position.market = market.key();
        position.yes_shares = 0;
        position.no_shares = 0;
        position.total_invested = 0;
        position.claimed = false;
        position.bump = ctx.bumps.position;
    }

    // Update position
    position.yes_shares = position
        .yes_shares
        .checked_add(shares)
        .ok_or(ErrorCode::MathError)?;

    position.total_invested = position
        .total_invested
        .checked_add(actual_sol_amount)
        .ok_or(ErrorCode::MathError)?;

    Ok(())
}
