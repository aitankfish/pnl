use anchor_lang::prelude::*;

/// Team vesting schedule for token distribution
///
/// Stores vesting information for the team's 33% token allocation
/// - 8% immediate (claimable at resolution)
/// - 25% vested (linear over 12 months with monthly unlock)
#[account]
pub struct TeamVesting {
    /// Market this vesting schedule belongs to
    pub market: Pubkey,

    /// Team wallet receiving the vested tokens
    pub team_wallet: Pubkey,

    /// Token mint address (created via Pump.fun)
    pub token_mint: Pubkey,

    /// Total tokens allocated to team (33% of total supply)
    pub total_tokens: u64,

    /// Immediate tokens (8% of total supply, claimable right away)
    pub immediate_tokens: u64,

    /// Vesting tokens (25% of total supply, vested over 12 months)
    pub vesting_tokens: u64,

    /// Tokens already claimed by team (includes both immediate and vested)
    pub claimed_tokens: u64,

    /// Whether immediate tokens have been claimed
    pub immediate_claimed: bool,

    /// Unix timestamp when vesting started (at market resolution)
    pub vesting_start: i64,

    /// Vesting duration in seconds (12 months = 31,536,000 seconds)
    pub vesting_duration: i64,

    /// Bump seed for PDA
    pub bump: u8,
}

impl TeamVesting {
    /// Space required for the account (in bytes)
    pub const SPACE: usize = 8 + // discriminator
        32 + // market
        32 + // team_wallet
        32 + // token_mint
        8 +  // total_tokens
        8 +  // immediate_tokens
        8 +  // vesting_tokens
        8 +  // claimed_tokens
        1 +  // immediate_claimed
        8 +  // vesting_start
        8 +  // vesting_duration
        1;   // bump

    /// 12 months in seconds (365 days / 12 = 30.4167 days per month, but we use 30 days)
    /// 12 * 30 * 24 * 60 * 60 = 31,104,000 seconds
    pub const VESTING_DURATION_SECONDS: i64 = 31_104_000;

    /// Calculate how many vested tokens are currently unlocked (linear vesting)
    ///
    /// Formula: (vesting_tokens * elapsed_time) / vesting_duration
    /// Capped at vesting_tokens after vesting period ends
    /// Note: This only calculates vested tokens, not immediate tokens
    pub fn calculate_unlocked_vested_tokens(&self, current_timestamp: i64) -> Result<u64> {
        let elapsed = current_timestamp
            .checked_sub(self.vesting_start)
            .unwrap_or(0);

        // If vesting period is complete, all vested tokens are unlocked
        if elapsed >= self.vesting_duration {
            return Ok(self.vesting_tokens);
        }

        // If vesting hasn't started yet, no vested tokens unlocked
        if elapsed <= 0 {
            return Ok(0);
        }

        // Calculate linear unlock: (vesting_tokens * elapsed) / duration
        let unlocked = (self.vesting_tokens as u128 * elapsed as u128
            / self.vesting_duration as u128) as u64;

        Ok(unlocked)
    }

    /// Calculate total claimable tokens (immediate + vested - already claimed)
    pub fn calculate_claimable_tokens(&self, current_timestamp: i64) -> Result<u64> {
        let mut claimable = 0u64;

        // Add immediate tokens if not yet claimed
        if !self.immediate_claimed {
            claimable = claimable
                .checked_add(self.immediate_tokens)
                .ok_or(anchor_lang::error::ErrorCode::AccountDidNotSerialize)?;
        }

        // Add unlocked vested tokens
        let unlocked_vested = self.calculate_unlocked_vested_tokens(current_timestamp)?;
        let vested_claimed = self.claimed_tokens.saturating_sub(
            if self.immediate_claimed { self.immediate_tokens } else { 0 }
        );
        let claimable_vested = unlocked_vested.saturating_sub(vested_claimed);

        claimable = claimable
            .checked_add(claimable_vested)
            .ok_or(anchor_lang::error::ErrorCode::AccountDidNotSerialize)?;

        Ok(claimable)
    }
}
