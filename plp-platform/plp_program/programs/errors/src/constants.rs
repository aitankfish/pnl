/// Platform-wide constants for PLP prediction markets

/// Market creation fee (0.015 SOL)
pub const CREATION_FEE_LAMPORTS: u64 = 15_000_000;

/// Trade fee in basis points (1.5% = 150 bps)
pub const TRADE_FEE_BPS: u64 = 150;

/// Completion fee when market resolves (5% = 500 bps)
pub const COMPLETION_FEE_BPS: u64 = 500;

/// Minimum investment per trade (0.01 SOL)
pub const MIN_INVESTMENT_LAMPORTS: u64 = 10_000_000;

/// Initial quantity for LMSR (both YES and NO start at 1000)
pub const INITIAL_Q: u64 = 1000;

/// Fixed-point precision for LMSR calculations (1e9)
pub const PRECISION: u128 = 1_000_000_000;

/// Maximum IPFS CID length (CIDv1 format - bafyXXX can be up to 59 chars)
pub const MAX_IPFS_CID_LEN: usize = 59;

/// Maximum metadata URI length
pub const MAX_METADATA_URI_LEN: usize = 200;

/// Basis points divisor (100%)
pub const BPS_DIVISOR: u64 = 10_000;

/// P&L Platform wallet for receiving 1% token allocation
pub const PNL_WALLET: &str = "3MihVtsLsVuEccpmz4YG72Cr8CJWf1evRorTPdPiHeEQ";

/// Pump.fun program ID (mainnet)
pub const PUMP_FUN_PROGRAM_ID: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

/// Token distribution percentages (in basis points)
pub const PLATFORM_TOKEN_SHARE_BPS: u64 = 200; // 2%
pub const TEAM_TOKEN_SHARE_BPS: u64 = 3300; // 33% (8% immediate + 25% vested)
pub const TEAM_IMMEDIATE_SHARE_BPS: u64 = 800; // 8% of total (immediate)
pub const TEAM_VESTED_SHARE_BPS: u64 = 2500; // 25% of total (vested over 12 months)
pub const YES_VOTERS_TOKEN_SHARE_BPS: u64 = 6500; // 65%
