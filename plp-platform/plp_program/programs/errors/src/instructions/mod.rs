//! Instruction module aggregator.

// Treasury management
pub mod init_treasury;
pub mod set_admin;
pub mod withdraw_fees;

pub use init_treasury::*;
pub use set_admin::*;
pub use withdraw_fees::*;

// Market creation
pub mod create_market;
pub use create_market::*;

// Trading instructions
pub mod buy_yes;
pub mod buy_no;

pub use buy_yes::*;
pub use buy_no::*;

// Market extension
pub mod extend_market;
pub use extend_market::*;

// Resolution and claims
pub mod resolve_market;
pub mod claim_rewards;
pub mod init_team_vesting;
pub mod claim_team_tokens;
pub mod init_founder_vesting;
pub mod claim_founder_sol;
pub mod claim_platform_tokens;

pub use resolve_market::*;
pub use claim_rewards::*;
pub use init_team_vesting::*;
pub use claim_team_tokens::*;
pub use init_founder_vesting::*;
pub use claim_founder_sol::*;
pub use claim_platform_tokens::*;

// Account cleanup (rent recovery)
pub mod close_position;
pub mod close_market;
pub mod emergency_drain_vault;

pub use close_position::*;
pub use close_market::*;
pub use emergency_drain_vault::*;

// Legacy instructions (deprecated - commented out for now)
// TODO: Fix compatibility issues in legacy instructions if needed
// These have been replaced by resolve_market + claim_rewards

// pub mod expire;
// pub mod finalize_yes;
// pub mod finalize_no;
// pub mod claim_no;
// pub mod claim_yes;
// pub mod refund;

// pub use expire::*;
// pub use finalize_yes::*;
// pub use finalize_no::*;
// pub use claim_no::*;
// pub use claim_yes::*;
// pub use refund::*;
