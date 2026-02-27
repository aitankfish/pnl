use anchor_lang::prelude::*;

/// Platform Treasury PDA
/// Holds accumulated platform fees from all markets.
#[account]
pub struct Treasury {
    pub admin: Pubkey,   // Founder or platform wallet
    pub total_fees: u64, // Total fees collected
    pub bump: u8,        // PDA bump
}

impl Treasury {
    pub const INIT_SPACE: usize = 32 + 8 + 1;
}
