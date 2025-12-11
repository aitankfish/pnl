use anchor_lang::prelude::*;

/// Founder vesting schedule for excess SOL distribution
///
/// Stores vesting information for founder's excess SOL (when pool > 50 SOL)
/// - 8% immediate (claimable at resolution)
/// - 92% vested (linear over 12 months)
#[account]
pub struct FounderVesting {
    /// Market this vesting schedule belongs to
    pub market: Pubkey,

    /// Founder wallet receiving the vested SOL
    pub founder: Pubkey,

    /// Total excess SOL allocated to founder
    pub total_sol: u64,

    /// Immediate SOL (8%, claimable right away)
    pub immediate_sol: u64,

    /// Vesting SOL (92%, vested over 12 months)
    pub vesting_sol: u64,

    /// SOL already claimed by founder (includes both immediate and vested)
    pub claimed_sol: u64,

    /// Whether immediate SOL has been claimed
    pub immediate_claimed: bool,

    /// Unix timestamp when vesting started (at market resolution)
    pub vesting_start: i64,

    /// Vesting duration in seconds (12 months = 31,104,000 seconds)
    pub vesting_duration: i64,

    /// Bump seed for PDA
    pub bump: u8,
}

impl FounderVesting {
    /// Space required for the account (in bytes)
    pub const SPACE: usize = 8 + // discriminator
        32 + // market
        32 + // founder
        8 +  // total_sol
        8 +  // immediate_sol
        8 +  // vesting_sol
        8 +  // claimed_sol
        1 +  // immediate_claimed
        8 +  // vesting_start
        8 +  // vesting_duration
        1;   // bump

    /// 12 months in seconds (12 * 30 * 24 * 60 * 60 = 31,104,000 seconds)
    pub const VESTING_DURATION_SECONDS: i64 = 31_104_000;

    /// Calculate how much vested SOL is currently unlocked (linear vesting)
    ///
    /// Formula: (vesting_sol * elapsed_time) / vesting_duration
    /// Capped at vesting_sol after vesting period ends
    /// Note: This only calculates vested SOL, not immediate SOL
    pub fn calculate_unlocked_vested_sol(&self, current_timestamp: i64) -> Result<u64> {
        let elapsed = current_timestamp
            .checked_sub(self.vesting_start)
            .unwrap_or(0);

        // If vesting period is complete, all vested SOL is unlocked
        if elapsed >= self.vesting_duration {
            return Ok(self.vesting_sol);
        }

        // If vesting hasn't started yet, no vested SOL unlocked
        if elapsed <= 0 {
            return Ok(0);
        }

        // Calculate linear unlock: (vesting_sol * elapsed) / duration
        let unlocked = (self.vesting_sol as u128 * elapsed as u128
            / self.vesting_duration as u128) as u64;

        Ok(unlocked)
    }

    /// Calculate total claimable SOL (immediate + vested - already claimed)
    pub fn calculate_claimable_sol(&self, current_timestamp: i64) -> Result<u64> {
        let mut claimable = 0u64;

        // Add immediate SOL if not yet claimed
        if !self.immediate_claimed {
            claimable = claimable
                .checked_add(self.immediate_sol)
                .ok_or(anchor_lang::error::ErrorCode::AccountDidNotSerialize)?;
        }

        // Add unlocked vested SOL
        let unlocked_vested = self.calculate_unlocked_vested_sol(current_timestamp)?;
        let vested_claimed = self.claimed_sol.saturating_sub(
            if self.immediate_claimed { self.immediate_sol } else { 0 }
        );
        let claimable_vested = unlocked_vested.saturating_sub(vested_claimed);

        claimable = claimable
            .checked_add(claimable_vested)
            .ok_or(anchor_lang::error::ErrorCode::AccountDidNotSerialize)?;

        Ok(claimable)
    }
}
