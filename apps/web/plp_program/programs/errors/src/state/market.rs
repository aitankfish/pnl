use anchor_lang::prelude::*;

/// Market phase for tracking prediction vs funding stages
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MarketPhase {
    /// Prediction phase: Trading until target_pool reached, votes count
    Prediction,
    /// Funding phase: Extended by owner after target reached, votes frozen
    Funding,
}

/// Market resolution status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MarketResolution {
    /// Market is still active/unresolved
    Unresolved,
    /// YES wins - token will be created and airdropped
    YesWins,
    /// NO wins - SOL redistributed to NO voters
    NoWins,
    /// Market failed to reach target - full refund
    Refund,
}

/// The primary on-chain record for a prediction market.
///
/// This account holds:
/// - Ownership/authority (creator/founder),
/// - Pointers to the SOL vault PDA (escrow) and platform treasury,
/// - The Constant Product AMM state (yes_pool, no_pool) for pricing YES/NO shares,
/// - Launch configuration (target pool size in lamports, expiry time),
/// - Resolution status (Unresolved/YesWins/NoWins/Refund),
/// - The metadata URI (used during Pump.fun token launch),
/// - Optional address of the newly created token mint (set when YES wins),
/// - Current pool balance for tracking actual SOL held
///
/// Notes:
/// * Uses Constant Product AMM (x * y = k) for pricing
/// * Prices always sum to 1.0: YES_price + NO_price = 1.0
/// * Resolution is determined by comparing total_yes_shares vs total_no_shares at expiry
#[account]
pub struct Market {
    /// Project founder who created this market
    pub founder: Pubkey,

    /// IPFS CID for project metadata (stored as bytes for determinism)
    pub ipfs_cid: String,

    /// Target pool size in lamports (5 / 10 / 15 SOL)
    pub target_pool: u64,

    /// Current pool balance (actual SOL held in market, tracked separately from vault)
    pub pool_balance: u64,

    /// Distribution pool (snapshot at resolution for proportional claims)
    /// For NO wins: Amount available for NO voters after completion fee
    /// For Refund: Not used (calculated per position)
    /// Set during resolution, used for claim calculations
    pub distribution_pool: u64,

    /// YES token reserves in AMM pool (scaled by 1e9)
    pub yes_pool: u64,

    /// NO token reserves in AMM pool (scaled by 1e9)
    pub no_pool: u64,

    /// Total YES shares distributed to all users (for determining winner)
    pub total_yes_shares: u64,

    /// Total NO shares distributed to all users (for determining winner)
    pub total_no_shares: u64,

    /// UNIX timestamp (seconds) when the market stops trading
    pub expiry_time: i64,

    /// Market phase (Prediction or Funding)
    pub phase: MarketPhase,

    /// Market resolution status
    pub resolution: MarketResolution,

    /// Pre-uploaded metadata URI (IPFS/Arweave/HTTPS) for Pump.fun
    pub metadata_uri: String,

    /// Token mint address (set after YES resolution and token creation)
    pub token_mint: Option<Pubkey>,

    /// Platform token allocation (2% of total supply, immediate claim)
    pub platform_tokens_allocated: u64,

    /// Whether platform has claimed their 2% token allocation
    pub platform_tokens_claimed: bool,

    /// YES voter token allocation (65% of total supply, proportional distribution)
    pub yes_voter_tokens_allocated: u64,

    /// Excess SOL allocated to founder (when pool > 50 SOL)
    pub founder_excess_sol_allocated: u64,

    /// Whether founder excess SOL vesting has been initialized
    pub founder_vesting_initialized: bool,

    /// Platform treasury address
    pub treasury: Pubkey,

    /// PDA bump seed
    pub bump: u8,
}

impl Market {
    /// Calculate space needed for Market account
    /// 32 (founder) + 64 (ipfs_cid) + 8 (target_pool) + 8 (pool_balance) + 8 (distribution_pool)
    /// + 8 (yes_pool) + 8 (no_pool) + 8 (total_yes_shares) + 8 (total_no_shares)
    /// + 8 (expiry_time) + 1 (phase enum) + 1 (resolution enum) + 200 (metadata_uri)
    /// + 33 (token_mint option) + 8 (platform_tokens_allocated) + 1 (platform_tokens_claimed)
    /// + 8 (yes_voter_tokens_allocated) + 8 (founder_excess_sol_allocated) + 1 (founder_vesting_initialized)
    /// + 32 (treasury) + 1 (bump) = ~443 bytes
    /// Adding padding for safety: 472 bytes
    pub const SPACE: usize = 8 + 472;
}
