# PLP Program Modification Plan
## Max Pool Cap & Founder SOL Vesting

## 📋 Current State Analysis

### Current Flow:
1. **Prediction Phase**: Market trades until `target_pool` reached
2. **Extend Market**: Founder can extend to Funding phase if YES winning + target reached
3. **Funding Phase**: Additional trading allowed, votes frozen
4. **Resolution**:
   - Takes 5% fee from total pool
   - Uses ALL remaining SOL (after fee) to buy tokens on pump.fun
   - Distributes tokens: 65% YES voters, 33% team (8% immediate + 25% vested), 2% platform

### Current Team Token Vesting:
- **TeamVesting account** exists for team's 33% TOKEN allocation
- 8% immediate, 25% vested over 12 months
- NO vesting for excess SOL - founder currently gets nothing if pool > target

## 🎯 Proposed Changes

### 1. Maximum Pool Cap: 50 SOL
**Rationale**: Cap maximum SOL used for token purchase to maintain consistent token economics

**Changes Required**:
- Add constant `MAX_POOL_FOR_TOKEN_LAUNCH: u64 = 50_000_000_000` (50 SOL in lamports)
- Modify `resolve_market.rs` to cap token purchase amount at 50 SOL

### 2. Founder SOL Vesting (New Feature)
**Rationale**: If pool > 50 SOL, excess SOL should go to founder with vesting instead of all being used for tokens

**Distribution Logic**:
```
Pool Size < 50 SOL:
├─ 5% fee → Treasury
└─ Remaining SOL → Buy tokens on pump.fun

Pool Size ≥ 50 SOL:
├─ 5% fee → Treasury
├─ 50 SOL → Buy tokens on pump.fun
└─ Excess SOL (pool - 5% - 50):
    ├─ 8% immediate → Founder (withdrawable immediately)
    └─ 92% vested → Founder (linear vest over 12 months)
```

### 3. Early Launch Option
**Rationale**: Allow founder to launch before expiry if pool fills up

**Current**: Market can only resolve after expiry OR founder in Funding phase
**Proposed**: Same - already supported via extend_market.rs

## 📝 Implementation Tasks

### Task 1: Add Founder SOL Vesting State
**File**: `src/state/founder_vesting.rs` (NEW)

```rust
#[account]
pub struct FounderVesting {
    /// Market this vesting belongs to
    pub market: Pubkey,

    /// Founder wallet receiving vested SOL
    pub founder: Pubkey,

    /// Total excess SOL allocated to founder
    pub total_sol: u64,

    /// Immediate SOL (8%, claimable right away)
    pub immediate_sol: u64,

    /// Vesting SOL (92%, vested over 12 months)
    pub vesting_sol: u64,

    /// SOL already claimed (includes both immediate and vested)
    pub claimed_sol: u64,

    /// Whether immediate SOL has been claimed
    pub immediate_claimed: bool,

    /// Unix timestamp when vesting started (at market resolution)
    pub vesting_start: i64,

    /// Vesting duration (12 months = 31,104,000 seconds)
    pub vesting_duration: i64,

    /// Bump seed
    pub bump: u8,
}

impl FounderVesting {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 1;
    pub const VESTING_DURATION_SECONDS: i64 = 31_104_000; // 12 months

    /// Calculate unlocked vested SOL (linear vesting)
    pub fn calculate_unlocked_vested_sol(&self, current_timestamp: i64) -> Result<u64> {
        let elapsed = current_timestamp.checked_sub(self.vesting_start).unwrap_or(0);

        if elapsed >= self.vesting_duration {
            return Ok(self.vesting_sol);
        }

        if elapsed <= 0 {
            return Ok(0);
        }

        let unlocked = (self.vesting_sol as u128 * elapsed as u128
            / self.vesting_duration as u128) as u64;
        Ok(unlocked)
    }

    /// Calculate total claimable SOL
    pub fn calculate_claimable_sol(&self, current_timestamp: i64) -> Result<u64> {
        let mut claimable = 0u64;

        if !self.immediate_claimed {
            claimable = claimable.checked_add(self.immediate_sol)?;
        }

        let unlocked_vested = self.calculate_unlocked_vested_sol(current_timestamp)?;
        let vested_claimed = self.claimed_sol.saturating_sub(
            if self.immediate_claimed { self.immediate_sol } else { 0 }
        );
        let claimable_vested = unlocked_vested.saturating_sub(vested_claimed);

        claimable = claimable.checked_add(claimable_vested)?;
        Ok(claimable)
    }
}
```

### Task 2: Update Constants
**File**: `src/constants.rs`

```rust
// Add new constant
pub const MAX_POOL_FOR_TOKEN_LAUNCH: u64 = 50_000_000_000; // 50 SOL

// Founder SOL vesting percentages (for excess SOL beyond 50)
pub const FOUNDER_IMMEDIATE_SHARE_BPS: u64 = 800;  // 8% immediate
pub const FOUNDER_VESTED_SHARE_BPS: u64 = 9200;     // 92% vested
```

### Task 3: Update Market State
**File**: `src/state/market.rs`

```rust
// Add to Market struct:
pub struct Market {
    // ... existing fields ...

    /// Excess SOL allocated to founder (if pool > 50 SOL)
    pub founder_excess_sol_allocated: u64,

    /// Whether founder excess SOL has been initialized to vesting
    pub founder_vesting_initialized: bool,
}

// Update SPACE calculation accordingly
```

### Task 4: Modify resolve_market.rs
**File**: `src/instructions/resolve_market.rs`

**Changes in YesWins branch** (around line 182-445):

```rust
MarketResolution::YesWins => {
    let vault_lamports = ctx.accounts.market_vault.lamports();

    // 1. Calculate 5% completion fee FIRST
    let completion_fee = (vault_lamports * COMPLETION_FEE_BPS) / BPS_DIVISOR;

    // 2. Calculate SOL available after fee
    let sol_after_fee = vault_lamports
        .checked_sub(completion_fee)
        .ok_or(ErrorCode::MathError)?;

    // 3. Determine SOL for token purchase (capped at 50 SOL)
    let sol_for_token_purchase = std::cmp::min(sol_after_fee, MAX_POOL_FOR_TOKEN_LAUNCH);

    // 4. Calculate excess SOL (if pool > 50 SOL after fee)
    let excess_sol = sol_after_fee.saturating_sub(MAX_POOL_FOR_TOKEN_LAUNCH);

    // 5. Reserve rent-exempt for vault
    let rent = Rent::get()?;
    let vault_rent_exempt = rent.minimum_balance(0);

    // 6. Calculate net amount for token purchase
    let total_reserved = vault_rent_exempt + completion_fee + excess_sol;
    let net_amount_for_token = vault_lamports
        .checked_sub(total_reserved)
        .ok_or(ErrorCode::MathError)?;

    // 7. Buy tokens with net_amount_for_token (same pump.fun CPI logic)
    // ... existing pump.fun buy CPI code ...

    // 8. Transfer completion fee to treasury (AFTER pump.fun CPI)
    // ... existing fee transfer code ...

    // 9. Handle excess SOL if any
    if excess_sol > 0 {
        // Calculate founder's immediate (8%) and vesting (92%) portions
        let founder_immediate_sol = (excess_sol * FOUNDER_IMMEDIATE_SHARE_BPS) / BPS_DIVISOR;
        let founder_vesting_sol = excess_sol
            .checked_sub(founder_immediate_sol)
            .ok_or(ErrorCode::MathError)?;

        // Transfer excess SOL to market account (for founder vesting claims)
        // Market account will hold: immediate (claimable) + vesting (time-locked)
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.market_vault.to_account_info(),
                    to: market.to_account_info(),
                },
                signer_seeds,
            ),
            excess_sol,
        )?;

        // Store allocation in market state
        market.founder_excess_sol_allocated = excess_sol;
        market.founder_vesting_initialized = false; // Will be initialized in separate instruction

        msg!("💰 Excess SOL allocated to founder: {} lamports", excess_sol);
        msg!("   Immediate (8%): {} lamports", founder_immediate_sol);
        msg!("   Vesting (92%): {} lamports", founder_vesting_sol);
    }

    // ... rest of existing YesWins logic ...
}
```

### Task 5: Create init_founder_vesting Instruction
**File**: `src/instructions/init_founder_vesting.rs` (NEW)

```rust
use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::ErrorCode;
use crate::state::*;

#[derive(Accounts)]
pub struct InitFounderVesting<'info> {
    #[account(
        mut,
        constraint = market.resolution == MarketResolution::YesWins @ ErrorCode::InvalidResolution,
        constraint = market.founder_excess_sol_allocated > 0 @ ErrorCode::NoExcessSol,
        constraint = !market.founder_vesting_initialized @ ErrorCode::AlreadyInitialized
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = founder,
        space = FounderVesting::SPACE,
        seeds = [b"founder_vesting", market.key().as_ref()],
        bump
    )]
    pub founder_vesting: Account<'info, FounderVesting>,

    #[account(
        mut,
        constraint = founder.key() == market.founder @ ErrorCode::Unauthorized
    )]
    pub founder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitFounderVesting>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let founder_vesting = &mut ctx.accounts.founder_vesting;

    let total_excess = market.founder_excess_sol_allocated;
    let immediate_sol = (total_excess * FOUNDER_IMMEDIATE_SHARE_BPS) / BPS_DIVISOR;
    let vesting_sol = total_excess.checked_sub(immediate_sol).ok_or(ErrorCode::MathError)?;

    // Initialize vesting account
    founder_vesting.market = market.key();
    founder_vesting.founder = market.founder;
    founder_vesting.total_sol = total_excess;
    founder_vesting.immediate_sol = immediate_sol;
    founder_vesting.vesting_sol = vesting_sol;
    founder_vesting.claimed_sol = 0;
    founder_vesting.immediate_claimed = false;
    founder_vesting.vesting_start = Clock::get()?.unix_timestamp;
    founder_vesting.vesting_duration = FounderVesting::VESTING_DURATION_SECONDS;
    founder_vesting.bump = ctx.bumps.founder_vesting;

    // Mark as initialized
    market.founder_vesting_initialized = true;

    msg!("✅ Founder SOL vesting initialized");
    msg!("   Total: {} lamports", total_excess);
    msg!("   Immediate (8%): {} lamports", immediate_sol);
    msg!("   Vesting (92%): {} lamports over 12 months", vesting_sol);

    Ok(())
}
```

### Task 6: Create claim_founder_sol Instruction
**File**: `src/instructions/claim_founder_sol.rs` (NEW)

```rust
use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::*;

#[derive(Accounts)]
pub struct ClaimFounderSol<'info> {
    #[account(
        seeds = [b"founder_vesting", market.key().as_ref()],
        bump = founder_vesting.bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        constraint = founder_vesting.market == market.key() @ ErrorCode::InvalidMarket,
        constraint = founder_vesting.founder == founder.key() @ ErrorCode::Unauthorized
    )]
    pub founder_vesting: Account<'info, FounderVesting>,

    #[account(
        mut,
        constraint = market.founder == founder.key() @ ErrorCode::Unauthorized
    )]
    pub founder: Signer<'info>,

    /// Market account (holds the excess SOL for distribution)
    #[account(mut)]
    pub market_account: Account<'info, Market>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimFounderSol>) -> Result<()> {
    let founder_vesting = &mut ctx.accounts.founder_vesting;
    let now = Clock::get()?.unix_timestamp;

    // Calculate claimable amount
    let claimable = founder_vesting.calculate_claimable_sol(now)?;
    require!(claimable > 0, ErrorCode::NothingToClaim);

    // Transfer SOL from market account to founder
    **ctx.accounts.market_account.to_account_info().try_borrow_mut_lamports()? -= claimable;
    **ctx.accounts.founder.to_account_info().try_borrow_mut_lamports()? += claimable;

    // Update vesting state
    if !founder_vesting.immediate_claimed && claimable >= founder_vesting.immediate_sol {
        founder_vesting.immediate_claimed = true;
    }

    founder_vesting.claimed_sol = founder_vesting
        .claimed_sol
        .checked_add(claimable)
        .ok_or(ErrorCode::MathError)?;

    msg!("💰 Founder claimed {} lamports SOL", claimable);
    msg!("   Total claimed: {}/{} lamports",
         founder_vesting.claimed_sol,
         founder_vesting.total_sol);

    Ok(())
}
```

### Task 7: Update mod.rs
**File**: `src/instructions/mod.rs`

```rust
// Add new modules
pub mod init_founder_vesting;
pub mod claim_founder_sol;

// Add to pub use
pub use init_founder_vesting::*;
pub use claim_founder_sol::*;
```

### Task 8: Add Error Codes
**File**: `src/errors.rs`

```rust
#[error_code]
pub enum ErrorCode {
    // ... existing errors ...

    #[msg("No excess SOL to vest")]
    NoExcessSol,

    #[msg("Founder vesting already initialized")]
    AlreadyInitialized,

    #[msg("Nothing to claim")]
    NothingToClaim,

    #[msg("Invalid market")]
    InvalidMarket,

    #[msg("Invalid resolution state")]
    InvalidResolution,
}
```

### Task 9: Update lib.rs
**File**: `src/lib.rs`

```rust
// Add new instruction handlers
pub fn init_founder_vesting(ctx: Context<InitFounderVesting>) -> Result<()> {
    instructions::init_founder_vesting::handler(ctx)
}

pub fn claim_founder_sol(ctx: Context<ClaimFounderSol>) -> Result<()> {
    instructions::claim_founder_sol::handler(ctx)
}
```

## 🧪 Testing Plan

### Unit Tests Needed:

1. **Test 1**: Pool < 50 SOL
   - Verify all SOL (after 5% fee) used for token purchase
   - Verify no founder vesting created

2. **Test 2**: Pool = 50 SOL
   - Verify exactly 50 SOL used for token purchase
   - Verify no excess SOL

3. **Test 3**: Pool = 60 SOL
   - Verify 5% fee (3 SOL) → treasury
   - Verify 50 SOL → token purchase
   - Verify ~7 SOL excess → founder vesting
     - 8% immediate (0.56 SOL)
     - 92% vested (6.44 SOL)

4. **Test 4**: Vesting Claims
   - Verify immediate claim works
   - Verify vested claim increases linearly
   - Verify full vesting after 12 months

5. **Test 5**: Edge Cases
   - Pool exactly at boundary (49.99 SOL, 50.01 SOL)
   - Multiple partial claims
   - Claim after full vesting period

## 📊 Migration Considerations

### Backwards Compatibility:
- **Existing markets** (already resolved): No impact
- **Active markets**: Will use new 50 SOL cap logic upon resolution
- **Market state**: Added fields are optional (default to 0/false)

### Deployment Steps:
1. Deploy new program version
2. Update frontend to handle:
   - 50 SOL cap messaging
   - Founder vesting UI
   - Excess SOL display
3. Test on devnet thoroughly
4. Deploy to mainnet

## ✅ Summary

This plan introduces:
1. **50 SOL cap** for token purchases (prevents over-allocation)
2. **Founder SOL vesting** for excess pool (8% immediate, 92% vested over 12 months)
3. **New state accounts**: FounderVesting
4. **New instructions**: init_founder_vesting, claim_founder_sol
5. **Backwards compatible** with existing markets

The implementation follows the same pattern as existing TeamVesting for tokens, but applies it to excess SOL for the founder.
