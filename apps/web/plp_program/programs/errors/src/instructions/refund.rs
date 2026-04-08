use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Refund SOL when the market expired without reaching the target.
/// Allowed if: state == 1 (Expired) AND total_sol_in < target_lamports.
#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        constraint = market.state == 1 @ ErrorCode::TooEarly, // 1 = Expired
        constraint = market.total_sol_in < market.target_lamports @ ErrorCode::RefundNotAllowed
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = position.market == market.key() @ ErrorCode::Unauthorized,
        constraint = position.user == user.key() @ ErrorCode::Unauthorized,
        constraint = !position.claimed_refund @ ErrorCode::AlreadyClaimed
    )]
    pub position: Account<'info, Position>,

    /// Vault PDA holding all user deposits (no fee taken on failed markets)
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    /// CHECK: system-owned lamports vault signed by PDA seeds
    pub vault_pda: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Refund>) -> Result<()> {
    let m = &mut ctx.accounts.market;
    let p = &mut ctx.accounts.position;

    // Must be at/after expiry (defensive)
    let now = Clock::get()?.unix_timestamp;
    require!(now >= m.expiry_ts, ErrorCode::TooEarly);

    // Totals must be positive
    let user_qty = p.yes_qty + p.no_qty;
    require!(user_qty > 0.0, ErrorCode::InsufficientBalance);

    let total_qty = m.q_yes + m.q_no;
    require!(total_qty > 0.0, ErrorCode::MathError);

    // Entire vault is refundable; no fee on failed markets
    let vault_balance = **ctx.accounts.vault_pda.to_account_info().lamports.borrow();

    // Pro-rata payout = floor(vault * user_qty / total_qty)
    let mut payout = ((vault_balance as f64) * (user_qty / total_qty)).floor() as u64;
    require!(payout > 0, ErrorCode::InsufficientBalance);

    // Derive signer seeds for vault PDA
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

    // Clamp payout to current vault balance (defensive vs rounding)
    let current_vault_bal = **ctx.accounts.vault_pda.to_account_info().lamports.borrow();
    if payout > current_vault_bal {
        payout = current_vault_bal;
    }

    // Transfer lamports vault -> user
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

    // Mark refunded to prevent double-claim
    p.claimed_refund = true;

    msg!(
        "↩️ Refund: {} lamports to {}, share={:.6}",
        payout,
        p.user,
        user_qty / total_qty
    );
    Ok(())
}
