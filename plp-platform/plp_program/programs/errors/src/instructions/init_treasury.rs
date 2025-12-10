use anchor_lang::prelude::*;
use crate::state::Treasury;

/// Initialize the treasury PDA (one-time operation)
///
/// Security Model:
/// - Treasury PDA can only be initialized ONCE (Anchor `init` enforces this)
/// - First caller becomes the initial admin
/// - Admin can transfer control via `set_admin` instruction
/// - Recommended: Deploy program, immediately initialize with secure wallet, then transfer admin
///
/// No hardcoded deployer check - relies on:
/// 1. Anchor's `init` constraint (prevents re-initialization)
/// 2. Race to initialize (deployer should do this immediately after deployment)
/// 3. Admin transfer capability (via set_admin instruction)
#[derive(Accounts)]
pub struct InitTreasury<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitTreasury>) -> Result<()> {
    let t = &mut ctx.accounts.treasury;

    // ✅ Security: Only authorized admin can initialize treasury
    const AUTHORIZED_ADMIN: &str = "7iyZKvd28ZcfVKUxeezwSkvdoQ9sN1D7pEGe42w8yTkZ";
    let authorized_admin = Pubkey::try_from(AUTHORIZED_ADMIN).unwrap();

    require!(
        ctx.accounts.payer.key() == authorized_admin,
        crate::errors::ErrorCode::Unauthorized
    );

    t.admin = ctx.accounts.payer.key();
    t.total_fees = 0;

    let (_pda, bump) = Pubkey::find_program_address(&[b"treasury"], ctx.program_id);
    t.bump = bump;

    msg!("✅ Treasury initialized");
    msg!("   Initial admin: {}", t.admin);
    msg!("   Treasury PDA: {}", ctx.accounts.treasury.key());
    msg!("   Bump: {}", bump);

    Ok(())
}
