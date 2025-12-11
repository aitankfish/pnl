use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("This market has already expired.")]
    MarketExpired,
    #[msg("Market is not yet expired.")]
    MarketNotExpired,
    #[msg("Cannot resolve market yet - must be expired or founder in funding phase.")]
    CannotResolveYet,
    #[msg("Market has already been resolved.")]
    AlreadyResolved,
    #[msg("User already has a position on the opposite side (one position per wallet).")]
    AlreadyHasPosition,
    #[msg("Investment amount is below the minimum required (0.01 SOL).")]
    InvestmentTooSmall,
    #[msg("The target pool has already been filled.")]
    CapReached,
    #[msg("This reward has already been claimed.")]
    AlreadyClaimed,
    #[msg("Only the platform authority can perform this action.")]
    Unauthorized,
    #[msg("Math overflow or invalid calculation occurred.")]
    MathError,
    #[msg("Failed to create token via Pump.fun CPI.")]
    PumpFunCpiFailed,
    #[msg("Invalid or excessively long metadata URI.")]
    InvalidMetadata,
    #[msg("Insufficient SOL balance for this market action.")]
    InsufficientBalance,
    #[msg("Invalid target pool size (must be 5, 10, or 15 SOL).")]
    InvalidTargetPool,
    #[msg("Market is not in the correct resolution state for this action.")]
    InvalidResolutionState,
    #[msg("Cannot close position - must claim rewards first or wait for refund state.")]
    CannotClosePosition,
    #[msg("Cannot close market - claim period has not ended yet (30 days after expiry).")]
    ClaimPeriodNotOver,
    #[msg("Cannot close market - pool still has unclaimed funds.")]
    PoolNotEmpty,
    #[msg("Market is not in the correct phase for this action.")]
    InvalidMarketPhase,
    #[msg("Target pool has not been reached yet - cannot extend.")]
    TargetNotReached,
    #[msg("YES must be winning to extend market for funding.")]
    YesNotWinning,
    #[msg("Invalid or corrupted account data format.")]
    InvalidAccountData,
    #[msg("No excess SOL available for founder vesting.")]
    NoExcessSol,
    #[msg("Founder vesting has already been initialized.")]
    AlreadyInitialized,
    #[msg("Nothing to claim at this time.")]
    NothingToClaim,
}
