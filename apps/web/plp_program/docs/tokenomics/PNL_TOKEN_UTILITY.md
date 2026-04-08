# $PNL Token Utility: Revenue Share for Staked Holders

## Executive Summary

This document outlines the tokenomics design for $PNL, the native token of pnl.market. The core utility is a **2.5% revenue share** mechanism that distributes platform fees to staked $PNL holders, creating direct alignment between token holders and platform success.

---

## Revenue Share Model

### Platform Fee Structure

pnl.market charges a **5% completion fee** on every successful prediction market that resolves (taken in SOL from the pooled amount).

| Fee Allocation | Percentage | Destination |
|----------------|------------|-------------|
| **Staker Revenue Share** | 2.5% | Distributed to staked $PNL holders |
| **Platform Treasury** | 2.5% | Development, marketing, operations |

### Current Fee Implementation

```rust
// From constants.rs
pub const COMPLETION_FEE_BPS: u64 = 500;  // 5% = 500 basis points

// Additional fees (not part of revenue share)
pub const CREATION_FEE_LAMPORTS: u64 = 15_000_000;  // 0.015 SOL per market
pub const TRADE_FEE_BPS: u64 = 150;  // 1.5% trading fee
```

### Revenue Flow

```
Market Resolves (YES or NO wins)
    ↓
5% Completion Fee Deducted
    ├── 2.5% → Revenue Vault (Staker Rewards)
    └── 2.5% → Platform Treasury
        ↓
Revenue Vault Accumulates SOL
    ↓
Weekly/Epoch Distribution
    ↓
Pro-rata to Staked $PNL Holders
```

---

## How Revenue Share Works

### 1. Fee Collection

All 2.5% staker fees are sent to a transparent on-chain **Revenue Vault** PDA:

```rust
// Proposed PDA derivation
seeds = [b"revenue_vault"]
```

### 2. Staking Mechanism

Holders stake $PNL tokens in the official staking program:
- Receive stake receipt/proof tokens
- Tokens locked for selected duration
- Pro-rata share based on stake weight

### 3. Reward Distribution

Options for distribution:
- **Weekly epochs** - Lower gas, predictable schedule
- **Per-resolution** - Real-time but higher costs
- **Manual claim** - User-initiated with accumulated rewards
- **Auto-compound** - Reinvest rewards (if in $PNL)

### 4. Reward Currency

Rewards distributed in **SOL** (native platform revenue):
- No inflationary token emissions
- Direct value from platform usage
- Sustainable yield tied to volume

---

## Staking Tiers (Proposed)

| Tier | Minimum Staked $PNL | Reward Multiplier | Notes |
|------|---------------------|-------------------|-------|
| **Bronze** | 100,000 | 0.5x | Entry level |
| **Silver** | 500,000 | 1.0x | Standard full share |
| **Gold** | 1,000,000+ | 1.5x | Diamond hands bonus |

### Multiplier Mechanics

The multiplier applies to your pro-rata portion:

```
Your Reward = (Your Stake × Your Multiplier) / (Total Weighted Stakes) × Revenue Pool
```

**Example:**
- Total staked: 10M $PNL
- Your stake: 1M $PNL (Gold tier, 1.5x multiplier)
- Weekly revenue pool: 100 SOL
- Your weighted stake: 1M × 1.5 = 1.5M
- Assuming average 1.0x multiplier for others: 9M × 1.0 = 9M
- Total weighted: 1.5M + 9M = 10.5M
- Your share: (1.5M / 10.5M) × 100 SOL = **14.29 SOL** (vs 10 SOL without multiplier)

---

## Revenue Projections

### Example Calculation

| Metric | Value |
|--------|-------|
| Weekly successful launches | 100 |
| Average pool size | 50 SOL |
| Total fees (5%) | 250 SOL |
| Revenue share pool (2.5%) | **125 SOL** |

### Yield Scenarios

| Weekly Volume | Revenue Pool | APY at 10M Staked | APY at 50M Staked |
|---------------|--------------|-------------------|-------------------|
| 5,000 SOL | 125 SOL | ~65% | ~13% |
| 10,000 SOL | 250 SOL | ~130% | ~26% |
| 25,000 SOL | 625 SOL | ~325% | ~65% |
| 50,000 SOL | 1,250 SOL | ~650% | ~130% |

*Note: APY assumes weekly compounding and stable SOL price*

---

## Implementation Options

### Option A: Custom Staking Program (Anchor)

Build a custom staking smart contract:

```rust
// Proposed account structures
pub struct StakePool {
    pub total_staked: u64,
    pub revenue_vault: Pubkey,
    pub last_distribution: i64,
    pub bump: u8,
}

pub struct UserStake {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub stake_time: i64,
    pub tier: StakeTier,
    pub unclaimed_rewards: u64,
    pub bump: u8,
}

pub enum StakeTier {
    Bronze,  // 100k-499k
    Silver,  // 500k-999k
    Gold,    // 1M+
}
```

**Instructions needed:**
- `initialize_pool` - Create staking pool
- `stake` - Stake $PNL tokens
- `unstake` - Withdraw staked tokens
- `claim_rewards` - Claim accumulated SOL rewards
- `distribute_rewards` - Admin/permissionless distribution trigger
- `update_tier` - Recalculate tier on stake change

**Pros:**
- Full control over mechanics
- Custom tier multipliers
- No external dependencies
- Lower per-transaction fees

**Cons:**
- Development time (2-4 weeks)
- Requires security audit
- Maintenance burden

### Option B: Streamflow Staking

Use Streamflow's permissionless staking infrastructure:

```typescript
// Using Streamflow SDK
import { StreamflowSolana } from "@streamflow/stream";

// Create staking pool
const stakingPool = await streamflow.staking.createPool({
  token: PNL_MINT,
  cap: 100_000_000,           // Max 100M tokens
  expirationDate: null,       // No expiration
  stakingDuration: 7 * 24 * 60 * 60,  // 7 days minimum
  rewardTokens: [WSOL_MINT],  // SOL rewards
});

// Add rewards from revenue vault
await streamflow.staking.addRewards({
  pool: stakingPool,
  amount: revenueAmount,
  token: WSOL_MINT,
});
```

**Streamflow Fees:**
- Pool creation: 0.99 SOL
- Reward distribution: 0.19% of rewards

**Pros:**
- Battle-tested, audited
- Built-in dashboard
- No development needed
- Automatic distribution

**Cons:**
- 0.19% fee on rewards
- Less customization (no tier multipliers)
- External dependency
- Fixed staking durations

### Option C: Hybrid Approach (Recommended)

Custom staking with Streamflow for distribution:

```
Custom Staking Contract          Streamflow Integration
        ↓                               ↓
- Stake/unstake $PNL            - Distribute SOL rewards
- Tier calculation              - Track reward epochs
- Multiplier logic              - User claiming UI
        ↓                               ↓
    Stake Registry ←→ Streamflow Reward Pool
```

**Pros:**
- Custom tier multipliers
- Audited distribution layer
- Best of both worlds

**Cons:**
- More complex integration
- Two systems to maintain

---

## Smart Contract Architecture

### Modified Fee Flow

**Current (resolve_market.rs):**
```rust
// 5% fee → 100% to treasury
let completion_fee = vault_balance * COMPLETION_FEE_BPS / BPS_DIVISOR;
// Transfer to treasury...
```

**Proposed:**
```rust
// 5% fee → split 50/50
let completion_fee = vault_balance * COMPLETION_FEE_BPS / BPS_DIVISOR;
let staker_share = completion_fee / 2;  // 2.5%
let treasury_share = completion_fee / 2; // 2.5%

// Transfer to revenue vault (for stakers)
invoke(
    &system_instruction::transfer(
        &market_vault.key(),
        &revenue_vault.key(),
        staker_share,
    ),
    &[market_vault.to_account_info(), revenue_vault.to_account_info()],
)?;

// Transfer to treasury
invoke(
    &system_instruction::transfer(
        &market_vault.key(),
        &treasury.key(),
        treasury_share,
    ),
    &[market_vault.to_account_info(), treasury.to_account_info()],
)?;
```

### New Accounts Required

```rust
// Revenue Vault PDA
#[account(
    mut,
    seeds = [b"revenue_vault"],
    bump
)]
pub revenue_vault: SystemAccount<'info>,

// Staking Pool
#[account]
pub struct StakingPool {
    pub pnl_mint: Pubkey,
    pub total_staked: u64,
    pub total_weighted_stake: u64,
    pub revenue_vault: Pubkey,
    pub last_epoch: u64,
    pub accumulated_rewards: u64,
    pub bump: u8,
}

// User Stake
#[account]
pub struct UserStake {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub weighted_amount: u64,
    pub tier: u8,
    pub stake_timestamp: i64,
    pub last_claim_epoch: u64,
    pub bump: u8,
}
```

---

## Distribution Mechanics

### Epoch-Based Distribution

```rust
pub struct RewardEpoch {
    pub epoch_number: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub total_rewards: u64,
    pub total_weighted_stake_snapshot: u64,
    pub distributed: bool,
}

// Calculate user rewards for an epoch
fn calculate_epoch_rewards(
    user_weighted_stake: u64,
    epoch_total_weighted_stake: u64,
    epoch_total_rewards: u64,
) -> u64 {
    (user_weighted_stake as u128 * epoch_total_rewards as u128
        / epoch_total_weighted_stake as u128) as u64
}
```

### Distribution Schedule Options

| Option | Frequency | Gas Cost | UX |
|--------|-----------|----------|-----|
| **Per-resolution** | Real-time | High | Best |
| **Daily** | 24h | Medium | Good |
| **Weekly** | 7d | Low | Standard |
| **Bi-weekly** | 14d | Lowest | Acceptable |

**Recommendation:** Weekly distribution balances gas efficiency with reasonable reward frequency.

---

## Governance Integration (Future)

### Voting Power

Staked $PNL could grant governance rights:
- Vote on fee adjustments
- Vote on treasury allocations
- Vote on new features
- Vote on buyback/burn ratios

### Buyback & Burn

A portion of treasury (2.5%) could be used for:
- $PNL buybacks from DEX
- Token burns (deflationary pressure)
- Liquidity provision

```
Treasury Income (2.5%)
    ├── 60% Operations & Development
    ├── 25% Marketing & Growth
    └── 15% Buyback & Burn (governance vote)
```

---

## Economic Flywheel

```
More Platform Usage
        ↓
Higher Fee Revenue
        ↓
Better Staking Yields
        ↓
More $PNL Demand
        ↓
Higher Token Price
        ↓
More Attention to Platform
        ↓
More Platform Usage
        ↑
      (repeat)
```

### Alignment Incentives

| Stakeholder | Incentive |
|-------------|-----------|
| **Stakers** | Promote platform, drive volume |
| **Creators** | Launch quality projects |
| **Voters** | Accurate predictions = more launches |
| **Team** | Platform success = treasury growth |

---

## Comparison: Inflationary vs Revenue Share

| Aspect | Inflationary Staking | Revenue Share (Proposed) |
|--------|---------------------|-------------------------|
| **Yield Source** | Token emissions | Platform fees |
| **Sustainability** | Dilutive long-term | Sustainable |
| **Token Price** | Sell pressure | Buy pressure |
| **Alignment** | Stake and dump | Stake and promote |
| **Bull Market** | Works initially | Works always |
| **Bear Market** | Death spiral risk | Reduced but sustainable |

---

## Implementation Phases

### Phase 1: Foundation
1. Modify `resolve_market` to split fees 50/50
2. Create Revenue Vault PDA
3. Track accumulated rewards on-chain

### Phase 2: Basic Staking
1. Deploy staking contract (custom or Streamflow)
2. Implement stake/unstake instructions
3. Basic pro-rata distribution (no tiers)

### Phase 3: Tier System
1. Add tier multipliers
2. Implement tier calculation on stake change
3. Update UI to show tiers

### Phase 4: Governance
1. Add voting power to staked tokens
2. Implement proposal system
3. Buyback/burn voting

---

## Security Considerations

### Smart Contract Risks

| Risk | Mitigation |
|------|------------|
| **Reentrancy** | Use checks-effects-interactions pattern |
| **Integer overflow** | Use checked math (Rust defaults) |
| **Access control** | PDA-based ownership verification |
| **Front-running** | Epoch snapshots prevent gaming |

### Economic Risks

| Risk | Mitigation |
|------|------------|
| **Whale dominance** | Tier caps, governance limits |
| **Low participation** | Attractive APY, marketing |
| **Volatility** | Rewards in SOL (stable relative to degen tokens) |

### Audit Recommendations

- [ ] Full staking contract audit before mainnet
- [ ] Economic model review
- [ ] Formal verification of reward math

---

## Technical Resources

### Staking Implementation References
- [Anchor Staking Tutorial](https://blockchain.oodles.io/dev-blog/Create-a-Staking-Smart-Contract-on-Solana-using-Anchor/)
- [Solana Staking Example (GitHub)](https://github.com/rpajo/solana-staking)
- [Building Staking on Solana](https://dev.to/dingtian/building-the-staking-smart-contract-with-solana-blockchain-20i0)

### Streamflow Resources
- [Streamflow Staking Pools](https://streamflow.finance/staking)
- [Create Staking Pool Docs](https://docs.streamflow.finance/en/articles/10006633-create-a-staking-pool)
- [Staking FAQ](https://docs.streamflow.finance/en/articles/10006731-staking-faq)
- [Streamflow SDK](https://github.com/streamflow-finance/js-sdk)

### Revenue Share Examples
- [Streamflow Active Staking Rewards](https://streamflow.finance/blog/introducing-permissionless-staking-on-streamflow)
- Streamflow's model: 31.7% of protocol revenue → staker buybacks

---

## Summary

The $PNL revenue share model transforms the token from speculative to utility-driven:

| Feature | Value Proposition |
|---------|-------------------|
| **2.5% Revenue Share** | Direct platform success alignment |
| **SOL Rewards** | Non-inflationary, real yield |
| **Tier Multipliers** | Reward long-term commitment |
| **Weekly Distribution** | Regular, predictable income |
| **Governance (Future)** | Community ownership |

**Core Message:**

> *"$PNL isn't just a meme - it's a yield-bearing asset tied directly to platform success. The more predictions, the more launches, the more SOL flows to stakers."*

**Tagline:**

> *Stake. Validate. Earn. Out of the trenches, together.*

---

## Appendix: Example Week

| Day | Successful Launches | Pool Sizes | Total Volume | Revenue Pool |
|-----|---------------------|------------|--------------|--------------|
| Mon | 12 | 45 SOL avg | 540 SOL | 13.5 SOL |
| Tue | 15 | 52 SOL avg | 780 SOL | 19.5 SOL |
| Wed | 18 | 48 SOL avg | 864 SOL | 21.6 SOL |
| Thu | 14 | 55 SOL avg | 770 SOL | 19.25 SOL |
| Fri | 20 | 60 SOL avg | 1,200 SOL | 30 SOL |
| Sat | 16 | 50 SOL avg | 800 SOL | 20 SOL |
| Sun | 10 | 42 SOL avg | 420 SOL | 10.5 SOL |
| **Total** | **105** | **50 SOL avg** | **5,374 SOL** | **134.35 SOL** |

With 10M $PNL staked:
- **Weekly yield:** 134.35 SOL / 10M tokens = 0.0000134 SOL per token
- **At $150/SOL:** ~$0.002 per token per week
- **Annualized:** ~$0.104 per token = **~10.4% APY** (assuming $1 token price)

Early stakers with smaller total stake pools see significantly higher yields.
