use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

#[derive(Accounts)]
pub struct FinalizeYes<'info> {
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

pub fn handler(ctx: Context<FinalizeYes>) -> Result<()> {
    let m = &mut ctx.accounts.market;

    // Must be at/after expiry and in expired phase
    let now = Clock::get()?.unix_timestamp;
    require!(now >= m.expiry_ts, ErrorCode::TooEarly);

    // Target must be met
    require!(
        m.total_sol_in >= m.target_lamports,
        ErrorCode::RefundNotAllowed
    );

    // YES must win (or tie => YES)
    require!(m.q_yes >= m.q_no, ErrorCode::WrongWinner);

    // 5% platform fee on total SOL in
    let total_in = m.total_sol_in;
    let platform_fee = total_in
        .checked_mul(5)
        .and_then(|v| v.checked_div(100))
        .ok_or(ErrorCode::MathError)?;

    // Transfer fee from vault -> treasury using PDA signer
    if platform_fee > 0 {
        // Derive the vault PDA again to get the bump
        let market_key = m.key();
        let (vault_key, vault_bump) =
            Pubkey::find_program_address(&[b"vault", market_key.as_ref()], ctx.program_id);
        require_keys_eq!(
            vault_key,
            ctx.accounts.vault_pda.key(),
            ErrorCode::Unauthorized
        );

        // Build stable seed slices
        let bump_seed = [vault_bump]; // needs its own local so the reference lives long enough
        let seeds: [&[u8]; 3] = [b"vault", market_key.as_ref(), &bump_seed];
        let signer_seeds: &[&[&[u8]]] = &[&seeds];

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

        // Book-keep total fees
        ctx.accounts.treasury.total_fees = ctx
            .accounts
            .treasury
            .total_fees
            .saturating_add(platform_fee);
    }

    // Mark winner + finalize
    m.winner = Some(true);
    m.finalized_yes = true;
    m.state = 2; // 2 = Finalized

    msg!(
        "🏁 Finalized YES. Fee sent: {} lamports. Remaining in vault: {} lamports",
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
