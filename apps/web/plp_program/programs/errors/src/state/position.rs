use anchor_lang::prelude::*;

/// Per-user position for a given market.
///
/// This account tracks how many YES/NO shares a user owns (as simple u64 counters).
/// These are NOT SPL tokens - just numbers stored in the account.
///
/// Shares are used as weights for proportional reward distribution:
/// - If YES wins: tokens distributed pro-rata by yes_shares
/// - If NO wins: SOL distributed pro-rata by no_shares
/// - If Refund: total_invested returned to user
///
/// The "one position per wallet" rule is enforced:
/// - If user has YES shares, they cannot buy NO shares
/// - If user has NO shares, they cannot buy YES shares
#[account]
pub struct Position {
    /// The wallet that owns this position
    pub user: Pubkey,

    /// The market this position belongs to
    pub market: Pubkey,

    /// YES shares owned (u64, not SPL tokens)
    pub yes_shares: u64,

    /// NO shares owned (u64, not SPL tokens)
    pub no_shares: u64,

    /// Total SOL invested by this user (for refund calculations)
    pub total_invested: u64,

    /// Whether the user has claimed their rewards (one-time flag)
    pub claimed: bool,

    /// PDA bump seed
    pub bump: u8,
}

impl Position {
    /// Calculate space needed for Position account
    /// 32 (user) + 32 (market) + 8 (yes_shares) + 8 (no_shares)
    /// + 8 (total_invested) + 1 (claimed) + 1 (bump) = 90 bytes
    /// Adding padding for safety: 128 bytes
    pub const SPACE: usize = 8 + 128;
}
