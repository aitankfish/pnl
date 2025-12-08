use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

// 🔐 Program ID for mainnet/devnet deployment (same ID for both networks)
declare_id!("C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86");

#[program]
pub mod plp_prediction_market {
    use super::*;

    // ========================================
    // TREASURY MANAGEMENT
    // ========================================

    /// Initialize the global Treasury PDA (one-time, deployer only)
    pub fn init_treasury(ctx: Context<InitTreasury>) -> Result<()> {
        instructions::init_treasury::handler(ctx)
    }

    /// Change treasury admin to a new pubkey (DAO/multisig, etc.)
    pub fn set_admin(ctx: Context<SetAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::set_admin::handler(ctx, new_admin)
    }

    /// Withdraw platform fees from Treasury PDA to a recipient wallet
    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        instructions::withdraw_fees::handler(ctx, amount)
    }

    // ========================================
    // MARKET CREATION
    // ========================================

    /// Create a new prediction market (project)
    ///
    /// Args:
    /// - ipfs_cid: IPFS CID for project metadata (max 46 chars)
    /// - target_pool: Target SOL pool size (5/10/15 SOL in lamports)
    /// - expiry_time: Unix timestamp when market expires
    /// - metadata_uri: Full metadata URI for pump.fun (max 200 chars)
    ///
    /// Charges 0.015 SOL creation fee to treasury
    pub fn create_market(
        ctx: Context<CreateMarket>,
        ipfs_cid: String,
        target_pool: u64,
        expiry_time: i64,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::create_market::handler(
            ctx,
            ipfs_cid,
            target_pool,
            expiry_time,
            metadata_uri,
        )
    }

    // ========================================
    // TRADING
    // ========================================

    /// Buy YES shares with SOL
    ///
    /// Args:
    /// - sol_amount: Amount of SOL to spend (lamports)
    ///
    /// Deducts 1.5% trade fee, calculates shares via LMSR
    /// Enforces one-position rule (cannot have NO shares)
    pub fn buy_yes(ctx: Context<BuyYes>, sol_amount: u64) -> Result<()> {
        instructions::buy_yes::handler(ctx, sol_amount)
    }

    /// Buy NO shares with SOL
    ///
    /// Args:
    /// - sol_amount: Amount of SOL to spend (lamports)
    ///
    /// Deducts 1.5% trade fee, calculates shares via LMSR
    /// Enforces one-position rule (cannot have YES shares)
    pub fn buy_no(ctx: Context<BuyNo>, sol_amount: u64) -> Result<()> {
        instructions::buy_no::handler(ctx, sol_amount)
    }

    // ========================================
    // MARKET EXTENSION
    // ========================================

    /// Extend market for additional funding
    ///
    /// Only callable by founder when:
    /// - Pool has reached target_pool
    /// - YES is winning (total_yes_shares > total_no_shares)
    /// - Market is still in Prediction phase
    ///
    /// After extension, market moves to Funding phase
    /// where trading can continue beyond target_pool with votes frozen
    pub fn extend_market(ctx: Context<ExtendMarket>) -> Result<()> {
        instructions::extend_market::handler(ctx)
    }

    // ========================================
    // RESOLUTION & CLAIMS
    // ========================================

    /// Resolve a market after expiry (platform authority only)
    ///
    /// Determines outcome:
    /// - q_yes > q_no → YesWins (token launch, 5% fee)
    /// - q_no > q_yes → NoWins (SOL distribution, 5% fee)
    /// - Equal or insufficient → Refund (no fees)
    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        instructions::resolve_market::handler(ctx)
    }

    /// Claim rewards after market resolution
    ///
    /// Handles all three scenarios:
    /// - YesWins: Proportional token airdrop (stub)
    /// - NoWins: Proportional SOL payout
    /// - Refund: Full refund of invested amount
    ///
    /// Position PDA is automatically closed and rent refunded to user
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::claim_rewards::handler(ctx)
    }

    /// Initialize team vesting schedule after YES wins
    ///
    /// Must be called after resolve_market when market resolves to YesWins
    /// Sets up 12-month linear vesting for team's 33% token allocation
    pub fn init_team_vesting(ctx: Context<InitTeamVesting>, total_token_supply: u64) -> Result<()> {
        instructions::init_team_vesting::handler(ctx, total_token_supply)
    }

    /// Claim vested team tokens (linear 12-month vesting)
    ///
    /// Allows the team to claim tokens based on vesting schedule
    /// Can be called multiple times as tokens unlock monthly
    pub fn claim_team_tokens(ctx: Context<ClaimTeamTokens>) -> Result<()> {
        instructions::claim_team_tokens::handler(ctx)
    }

    /// Claim platform's 2% token allocation (immediate, no vesting)
    ///
    /// Transfers tokens to P&L wallet: 3MihVtsLsVuEccpmz4YG72Cr8CJWf1evRorTPdPiHeEQ
    /// Can be called by anyone after token launch
    pub fn claim_platform_tokens(ctx: Context<ClaimPlatformTokens>) -> Result<()> {
        instructions::claim_platform_tokens::handler(ctx)
    }

    // ========================================
    // ACCOUNT CLEANUP (RENT RECOVERY)
    // ========================================

    /// Close a position account and recover rent
    ///
    /// Allows users to close their position and recover the PDA rent (~0.002 SOL)
    /// Can be called after rewards are claimed, or in refund scenarios
    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        instructions::close_position::handler(ctx)
    }

    /// Close a market account and recover rent
    ///
    /// Allows founder to close the market PDA after:
    /// - Market is resolved
    /// - Claim period has ended (30 days after expiry)
    /// - Pool balance is empty
    ///
    /// Recovers market rent (~0.01 SOL) to founder
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        instructions::close_market::handler(ctx)
    }

    /// Emergency drain vault to founder (platform admin only)
    ///
    /// Drains all SOL from market vault (minus rent-exempt) to market founder
    /// Works with both program-owned and system-owned vaults
    /// Only callable by platform admin (treasury.admin) for emergency recovery
    pub fn emergency_drain_vault(ctx: Context<EmergencyDrainVault>) -> Result<()> {
        instructions::emergency_drain_vault::handler(ctx)
    }

    // ========================================
    // LEGACY INSTRUCTIONS (DEPRECATED & REMOVED)
    // ========================================
    // These have been replaced by resolve_market + claim_rewards
    // Commented out due to compatibility issues with new state structure
    // If needed, can be reimplemented to work with new MarketResolution enum

    // /// @deprecated Use resolve_market instead
    // pub fn expire(ctx: Context<Expire>) -> Result<()> {
    //     instructions::expire::handler(ctx)
    // }

    // /// @deprecated Use resolve_market instead
    // pub fn finalize_yes(ctx: Context<FinalizeYes>) -> Result<()> {
    //     instructions::finalize_yes::handler(ctx)
    // }

    // /// @deprecated Use resolve_market instead
    // pub fn finalize_no(ctx: Context<FinalizeNo>) -> Result<()> {
    //     instructions::finalize_no::handler(ctx)
    // }

    // /// @deprecated Use claim_rewards instead
    // pub fn claim_no(ctx: Context<ClaimNo>) -> Result<()> {
    //     instructions::claim_no::handler(ctx)
    // }

    // /// @deprecated Use claim_rewards instead
    // pub fn claim_yes(ctx: Context<ClaimYes>) -> Result<()> {
    //     instructions::claim_yes::handler(ctx)
    // }

    // /// @deprecated Use claim_rewards instead
    // pub fn refund(ctx: Context<Refund>) -> Result<()> {
    //     instructions::refund::handler(ctx)
    // }
}
