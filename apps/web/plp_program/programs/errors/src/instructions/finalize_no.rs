use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

/// Finalize a market as NO-winning.
///
/// Requirements:
/// - market.state == 1 (Expired)
/// - now >= expiry_ts
/// - caller is the market creator
/// - pool target met (total_sol_in >= target_lamports)
/// - NO beats or ties YES (q_no >= q_yes)
/// Effects:
/// - transfers 5% platform fee from vault PDA -> Treasury PDA
/// - records winner=Some(false), state=2 (Finalized)
/// - remaining vault balance will be used by claim_no() to pay NO voters
#[derive(Accounts)]
pub struct FinalizeNo<'info> {
    #[account(
        mut,
        constraint = market.state == 1 @ ErrorCode::TooEarly,            // 1 = Expired
        constraint = market.creator == creator.key() @ ErrorCode::Unauthorized
    )]
    pub market: Account<'info, Market>,

    /// Vault PDA holding the market’s SOL
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    /// CHECK: system-owned lamports vault; signed with PDA seeds
    pub vault_pda: UncheckedAccount<'info>,

    /// Global Treasury PDA (receives platform fee)
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    /// Market creator (must sign)
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<FinalizeNo>) -> Result<()> {
    let m = &mut ctx.accounts.market;

    // Must be at/after expiry and in expired phase
    let now = Clock::get()?.unix_timestamp;
    require!(now >= m.expiry_ts, ErrorCode::TooEarly);

    // Target must be met (if not, use refund() path instead)
    require!(
        m.total_sol_in >= m.target_lamports,
        ErrorCode::RefundNotAllowed
    );

    // NO must win (or tie => NO)
    require!(m.q_no >= m.q_yes, ErrorCode::WrongWinner);

    // 5% platform fee on total SOL in
    let total_in = m.total_sol_in;
    let platform_fee = total_in
        .checked_mul(5)
        .and_then(|v| v.checked_div(100))
        .ok_or(ErrorCode::MathError)?;

    if platform_fee > 0 {
        // Derive vault bump, build signer seeds
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

        // Transfer fee from vault -> treasury
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.vault_pda.key(),
            &ctx.accounts.treasury.key(),
            platform_fee,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.vault_pda.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        // Book-keep platform fees
        ctx.accounts.treasury.total_fees = ctx
            .accounts
            .treasury
            .total_fees
            .saturating_add(platform_fee);
    }

    // Mark NO as winner and finalize
    m.winner = Some(false);
    m.state = 2; // 2 = Finalized

    msg!(
        "🏁 Finalized NO. Fee sent: {} lamports. Remaining in vault: {} lamports",
        platform_fee,
        vault_remaining(&ctx.accounts.vault_pda, platform_fee)?
    );

    Ok(())
}

fn vault_remaining(vault: &UncheckedAccount, platform_fee: u64) -> Result<u64> {
    let current = **vault.to_account_info().lamports.borrow();
    current
        .checked_sub(platform_fee)
        .ok_or(error!(ErrorCode::MathError))
}
