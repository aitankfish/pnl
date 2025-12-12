use anchor_lang::prelude::*;
use crate::state::{Market, MarketPhase, MarketResolution};

/// Old Market struct before vesting fields were added
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MarketV1 {
    pub founder: Pubkey,
    pub ipfs_cid: String,
    pub target_pool: u64,
    pub pool_balance: u64,
    pub distribution_pool: u64,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub total_yes_shares: u64,
    pub total_no_shares: u64,
    pub expiry_time: i64,
    pub phase: MarketPhase,
    pub resolution: MarketResolution,
    pub metadata_uri: String,
    pub token_mint: Option<Pubkey>,
    pub platform_tokens_allocated: u64,
    pub platform_tokens_claimed: bool,
    pub yes_voter_tokens_allocated: u64,
    pub treasury: Pubkey,
    pub bump: u8,
}

/// Migrate old Market accounts (466 bytes) to new version (480 bytes)
/// Adds founder vesting fields to existing markets
#[derive(Accounts)]
pub struct MigrateMarketV2<'info> {
    /// CHECK: Using UncheckedAccount because old account size prevents deserialization
    #[account(mut)]
    pub market: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MigrateMarketV2>) -> Result<()> {
    let account_info = ctx.accounts.market.to_account_info();
    let current_space = account_info.data_len();
    let new_space = Market::SPACE;

    msg!("Current size: {} bytes", current_space);
    msg!("Target size: {} bytes", new_space);

    // Try to deserialize as old MarketV1 struct (works for both 466 and incorrectly migrated 480 byte accounts)
    let data = account_info.try_borrow_data()?;
    let mut data_slice: &[u8] = &data[8..]; // Skip discriminator

    let old_market = match MarketV1::deserialize(&mut data_slice) {
        Ok(market) => {
            msg!("Deserialized as V1 successfully");
            market
        }
        Err(_) => {
            msg!("Account already migrated or corrupted");
            drop(data);
            return Ok(());
        }
    };
    drop(data); // Release borrow

    // Only reallocate if not already at target size
    if current_space < new_space {
        // Calculate additional rent needed
        let rent = Rent::get()?;
        let new_minimum_balance = rent.minimum_balance(new_space);
        let current_lamports = account_info.lamports();

        if new_minimum_balance > current_lamports {
            let additional_rent = new_minimum_balance - current_lamports;
            msg!("Transferring additional rent: {} lamports", additional_rent);

            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: account_info.clone(),
                    },
                ),
                additional_rent,
            )?;
        }

        // Reallocate to new size
        account_info.realloc(new_space, false)?;
        msg!("Reallocated from {} to {} bytes", current_space, new_space);
    } else {
        msg!("Account already {} bytes, no reallocation needed", new_space);
    }

    // Create new Market struct with vesting fields initialized to defaults
    let new_market = Market {
        founder: old_market.founder,
        ipfs_cid: old_market.ipfs_cid,
        target_pool: old_market.target_pool,
        pool_balance: old_market.pool_balance,
        distribution_pool: old_market.distribution_pool,
        yes_pool: old_market.yes_pool,
        no_pool: old_market.no_pool,
        total_yes_shares: old_market.total_yes_shares,
        total_no_shares: old_market.total_no_shares,
        expiry_time: old_market.expiry_time,
        phase: old_market.phase,
        resolution: old_market.resolution,
        metadata_uri: old_market.metadata_uri,
        token_mint: old_market.token_mint,
        platform_tokens_allocated: old_market.platform_tokens_allocated,
        platform_tokens_claimed: old_market.platform_tokens_claimed,
        yes_voter_tokens_allocated: old_market.yes_voter_tokens_allocated,
        founder_excess_sol_allocated: 0,          // NEW FIELD
        founder_vesting_initialized: false,        // NEW FIELD
        treasury: old_market.treasury,
        bump: old_market.bump,
    };

    // Serialize new market and write to account
    let mut data = account_info.try_borrow_mut_data()?;
    let dst: &mut [u8] = &mut data;
    let mut writer: &mut [u8] = dst;
    new_market.try_serialize(&mut writer)?;

    msg!("✅ Migration complete!");
    Ok(())
}
