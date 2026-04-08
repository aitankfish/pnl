use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Claim SOL when NO is the winner.
/// Payout = floor( (total_in - fee_5pct) * (user_no_qty / total_no_qty) )
#[derive(Accounts)]
pub struct ClaimNo<'info> {
    #[account(
        mut,
        constraint = market.state == 2 @ ErrorCode::TooEarly, // 2 = Finalized
        constraint = market.winner == Some(false) @ ErrorCode::WrongWinner
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = position.market == market.key() @ ErrorCode::Unauthorized,
        constraint = position.user == user.key() @ ErrorCode::Unauthorized,
        constraint = !position.claimed_no @ ErrorCode::AlreadyClaimed
    )]
    pub position: Account<'info, Position>,

    /// Vault PDA that holds market funds (post-fee)
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    /// CHECK: system-owned lamports vault
    pub vault_pda: UncheckedAccount<'info>,

    /// Recipient of SOL
    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimNo>) -> Result<()> {
    let m = &mut ctx.accounts.market;
    let p = &mut ctx.accounts.position;

    // Safety: user must actually hold NO shares
    require!(p.no_qty > 0.0, ErrorCode::InsufficientBalance);
    // Safety: total NO must be > 0
    require!(m.q_no > 0.0, ErrorCode::MathError);

    // Distributable pool (post-fee); fee was 5% of total_in.
    // Recompute deterministically from market totals to avoid order dependence.
    let fee = m
        .total_sol_in
        .checked_mul(5)
        .and_then(|v| v.checked_div(100))
        .ok_or(ErrorCode::MathError)?;
    let distributable = m
        .total_sol_in
        .checked_sub(fee)
        .ok_or(ErrorCode::MathError)?;

    // Pro-rata payout in lamports (floor to avoid over-distribution)
    // NOTE: m.q_no / p.no_qty are f64; convert with care.
    let ratio = (p.no_qty / m.q_no) as f64;
    let mut payout = (ratio * distributable as f64).floor() as u64;

    // Defensive clamp to available vault balance in case of rounding
    let vault_balance = **ctx.accounts.vault_pda.to_account_info().lamports.borrow();
    if payout > vault_balance {
        payout = vault_balance;
    }
    require!(payout > 0, ErrorCode::InsufficientBalance);

    // Transfer lamports from vault PDA → user using PDA signer
    let market_key = m.key();
    let (vault_key, vault_bump) =
        Pubkey::find_program_address(&[b"vault", market_key.as_ref()], ctx.program_id);
    require_keys_eq!(
        vault_key,
        ctx.accounts.vault_pda.key(),
        ErrorCode::Unauthorized
    );

    let bump_seed = [vault_bump];
    let seeds: [&[u8]; 3] = [b"vault", market_key.as_ref(), &bump_seed];
    let signer_seeds: &[&[&[u8]]] = &[&seeds];

    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.vault_pda.key(),
        &ctx.accounts.user.key(),
        payout,
    );
    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.vault_pda.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    // Mark as claimed
    p.claimed_no = true;

    msg!(
        "💰 NO-claim: {} lamports to {}, share={:.6}",
        payout,
        ctx.accounts.user.key(),
        ratio
    );

    Ok(())
}
