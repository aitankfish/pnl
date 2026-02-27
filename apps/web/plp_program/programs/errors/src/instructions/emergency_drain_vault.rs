use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;

/// Emergency instruction to drain a vault back to founder
///
/// This is used to recover funds from vaults that need emergency intervention.
/// Handles both program-owned vaults (old bug) and system-owned vaults (correct).
///
/// Only callable by platform admin (treasury.admin)
/// Funds always go to market.founder (cannot be redirected)
#[derive(Accounts)]
pub struct EmergencyDrainVault<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// Market Vault PDA (can be program-owned or system-owned)
    /// CHECK: Validated via PDA derivation
    #[account(
        mut,
        seeds = [b"market_vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: UncheckedAccount<'info>,

    /// Global Treasury PDA (for admin authorization check)
    #[account(
        seeds = [b"treasury"],
        bump = treasury.bump,
        constraint = market.treasury == treasury.key() @ crate::errors::ErrorCode::Unauthorized
    )]
    pub treasury: Account<'info, Treasury>,

    /// Market founder (receives the drained funds)
    /// CHECK: This is the founder from market.founder, no need to verify
    #[account(mut)]
    pub founder: UncheckedAccount<'info>,

    /// Platform admin (only treasury admin can call emergency operations)
    #[account(
        mut,
        constraint = caller.key() == treasury.admin @ crate::errors::ErrorCode::Unauthorized
    )]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<EmergencyDrainVault>) -> Result<()> {
    // Verify founder account matches market.founder
    require!(
        ctx.accounts.founder.key() == ctx.accounts.market.founder,
        crate::errors::ErrorCode::Unauthorized
    );

    // Prevent duplicate mutable account attack
    require!(
        ctx.accounts.founder.key() != ctx.accounts.market_vault.key(),
        crate::errors::ErrorCode::Unauthorized
    );

    // Get vault balance
    let vault_balance = ctx.accounts.market_vault.lamports();

    // Keep minimum rent-exempt amount in vault (it's a PDA, needs to stay alive)
    let rent = Rent::get()?;
    let rent_exempt = rent.minimum_balance(0);

    // Amount to transfer = balance - rent_exempt
    let transfer_amount = vault_balance
        .checked_sub(rent_exempt)
        .unwrap_or(0);

    require!(transfer_amount > 0, crate::errors::ErrorCode::InsufficientBalance);

    // Verify vault ownership (must be program-owned or system-owned)
    let vault_owner = ctx.accounts.market_vault.owner;
    require!(
        vault_owner == ctx.program_id || vault_owner == &System::id(),
        crate::errors::ErrorCode::Unauthorized
    );

    // Handle both vault ownership types differently
    if vault_owner == ctx.program_id {
        // Program-owned vault: use direct lamport manipulation
        // (We own it, so we can modify lamports directly)
        **ctx.accounts.market_vault.try_borrow_mut_lamports()? -= transfer_amount;
        **ctx.accounts.founder.try_borrow_mut_lamports()? += transfer_amount;
    } else {
        // System-owned vault: use invoke_signed with System Program
        // (System Program owns it, so we need CPI with PDA signing)
        let market_key = ctx.accounts.market.key();
        let vault_seeds = &[
            b"market_vault",
            market_key.as_ref(),
            &[ctx.bumps.market_vault],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.market_vault.to_account_info(),
                    to: ctx.accounts.founder.to_account_info(),
                },
                signer_seeds,
            ),
            transfer_amount,
        )?;
    }

    // Update market pool balance to reflect drained vault
    ctx.accounts.market.pool_balance = rent_exempt;

    Ok(())
}
