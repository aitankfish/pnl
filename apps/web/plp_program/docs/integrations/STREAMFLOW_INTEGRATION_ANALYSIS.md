# Streamflow Integration Analysis

## Executive Summary

This document analyzes whether P&L should use **Streamflow** for token locking/vesting instead of the current custom implementation.

**Recommendation:** Use a **hybrid approach** - keep custom YES voter distribution but consider Streamflow for founder/team vesting due to its flexibility, auditability, and reduced maintenance burden.

---

## Current P&L Vesting Implementation

### Token Distribution Breakdown

| Allocation | Percentage | Vesting | Current Implementation |
|------------|------------|---------|------------------------|
| **YES Voters** | 65% | Immediate | `claim_rewards` instruction |
| **Team** | 33% | 8% immediate + 25% over 12mo | `TeamVesting` PDA |
| **Platform** | 2% | Immediate | `claim_platform_tokens` instruction |
| **Founder (excess SOL)** | 100% of excess | 8% immediate + 92% over 12mo | `FounderVesting` PDA |

### Current Architecture

```
Market Resolves YES
    ↓
resolve_market instruction
    ├── Buy tokens from Pump.fun (up to 50 SOL)
    ├── Store allocations in Market state
    └── Excess SOL → Market account (escrow)
        ↓
Three parallel vesting paths:
    ├── init_team_vesting → TeamVesting PDA
    │   └── claim_team_tokens (repeatable)
    │
    ├── init_founder_vesting → FounderVesting PDA
    │   └── claim_founder_sol (repeatable)
    │
    └── claim_rewards (for YES voters, immediate)
```

### Key Files

| Component | File Path |
|-----------|-----------|
| Founder Vesting State | `plp_program/programs/errors/src/state/founder_vesting.rs` |
| Team Vesting State | `plp_program/programs/errors/src/state/team_vesting.rs` |
| Init Founder Vesting | `plp_program/programs/errors/src/instructions/init_founder_vesting.rs` |
| Init Team Vesting | `plp_program/programs/errors/src/instructions/init_team_vesting.rs` |
| Claim Founder SOL | `plp_program/programs/errors/src/instructions/claim_founder_sol.rs` |
| Claim Team Tokens | `plp_program/programs/errors/src/instructions/claim_team_tokens.rs` |
| Claim Rewards | `plp_program/programs/errors/src/instructions/claim_rewards.rs` |
| Constants | `plp_program/programs/errors/src/constants.rs` |

### Current Limitations

| Issue | Impact | Severity |
|-------|--------|----------|
| **Fixed 12-month duration** | No flexibility for different vesting periods | Medium |
| **Linear only** | No milestone-based or custom curves | Low |
| **No cliff configuration** | Hardcoded 8% immediate, 92% vested | Medium |
| **No pause/cancel** | Cannot adjust after initialization | High |
| **Hardcoded allocations** | Cannot customize per market | Medium |
| **No governance** | Platform wallet is hardcoded | Medium |
| **Custom code maintenance** | Security responsibility on team | High |
| **Limited visibility** | No dashboard for tracking vesting | Medium |

---

## Streamflow Overview

### What is Streamflow?

Streamflow is the leading token infrastructure platform on Solana, providing:
- **Token Vesting** - Customizable vesting schedules with cliff, linear, milestone options
- **Token Locks** - Lock tokens until a specific date
- **Airdrops** - Distribute to millions of recipients via merkle trees
- **Staking** - Create staking pools

### Program IDs

| Network | Program ID |
|---------|------------|
| **Mainnet** | `strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m` |
| **Devnet** | `HqDGZjaVRXJ9MGRQEw7qDc2rAr6iH1n1kAQdCZaCMfMZ` |
| **Community (Timelock)** | `8e72pYCDaxu3GqMfeQ5r8wFgoZSYk6oua1Qo9XpsZjX` |

### Fees (Solana)

| Operation | Cost |
|-----------|------|
| **Protocol fee on tokens** | 0% |
| **Vesting/Lock creation** | 0.117 SOL |
| **Staking pool creation** | 0.99 SOL |
| **Airdrop claim (recipient pays)** | 0.0065 - 0.01287 SOL |
| **Auto-claim setup** | 0.19 SOL |
| **Airdrop clawback** | 1.287% of tokens |
| **Network fees (rent)** | ~0.015 SOL |

### SDK Installation

```bash
# Vesting/Locks
npm install @streamflow/stream

# Airdrops (Distributor)
npm install @streamflow/common @streamflow/distributor
```

### SDK Usage Example

```typescript
import { StreamflowSolana, getBN } from "@streamflow/stream";

// Initialize client
const client = new StreamflowSolana.SolanaStreamClient(
  "https://api.mainnet-beta.solana.com"
);

// Create vesting stream
const vestingParams = {
  recipient: "recipient_wallet_address",
  tokenId: "token_mint_address",
  start: Math.floor(Date.now() / 1000),  // Now
  amount: getBN(1000000, 6),              // 1M tokens (6 decimals)
  period: 86400,                          // 1 day unlock period
  cliff: Math.floor(Date.now() / 1000) + 2592000, // 30-day cliff
  cliffAmount: getBN(100000, 6),          // 100k at cliff
  amountPerPeriod: getBN(2500, 6),        // 2.5k per day after cliff
  name: "Team Vesting",
  canTopup: false,                        // No additional deposits
  cancelableBySender: true,               // Can cancel if needed
  cancelableByRecipient: false,
  transferableBySender: true,             // Can transfer to new recipient
  transferableByRecipient: false,
  automaticWithdrawal: false,
};

const { ixs, tx, metadata } = await client.create(
  vestingParams,
  { sender: wallet }
);
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Customizable cliff** | Any cliff amount and timestamp |
| **Flexible periods** | Any unlock frequency (daily, weekly, monthly) |
| **Cancelable** | Sender can cancel and recover unvested tokens |
| **Transferable** | Stream ownership can be transferred |
| **Auto-withdrawal** | 3rd party can trigger withdrawals |
| **Price-based vesting** | Unlock based on token price (oracle) |
| **Batch creation** | Create multiple streams in one tx |
| **Dashboard** | Visual tracking of all vesting streams |

---

## Streamflow Distributor (Airdrops)

For distributing tokens to YES voters (currently 65% allocation), Streamflow's Distributor offers:

### Capabilities

- **Scale**: Up to 1M recipients
- **Merkle tree**: Constant cost regardless of recipient count
- **Vested airdrops**: Combine airdrop with vesting schedules
- **Claim portal**: Recipients claim their tokens
- **Clawback**: Recover unclaimed tokens after deadline

### SDK Usage

```typescript
import { SolanaDistributorClient } from "@streamflow/distributor/solana";

const distributorClient = new SolanaDistributorClient(
  "https://api.mainnet-beta.solana.com"
);

// Create airdrop with merkle tree
const airdropParams = {
  mint: tokenMintAddress,
  version: 0,
  root: merkleRoot,           // Pre-computed merkle root
  maxTotalClaim: totalTokens,
  maxNumNodes: recipientCount,
  unlockPeriod: 0,            // Immediate unlock (or set vesting)
  startVestingTs: 0,
  endVestingTs: 0,
  clawbackStartTs: clawbackTimestamp,
  claimsClosable: true,
};

await distributorClient.create(airdropParams, { invoker: wallet });
```

### Comparison: Current vs Streamflow Distributor

| Aspect | Current (claim_rewards) | Streamflow Distributor |
|--------|------------------------|------------------------|
| **Max recipients** | Unlimited (but high tx count) | 1M+ (merkle tree) |
| **Cost per claim** | ~0.00001 SOL (network) | 0.0065-0.01287 SOL |
| **Sender cost** | Per-recipient tx fees | Flat creation cost |
| **Vested airdrops** | Not supported | Supported |
| **Clawback** | Not supported | Supported |
| **Dashboard** | Custom (needs building) | Built-in |

---

## Comparison: Custom vs Streamflow

### Feature Comparison

| Feature | Current Custom | Streamflow |
|---------|---------------|------------|
| **Cliff configuration** | Fixed 8% immediate | Fully customizable |
| **Vesting period** | Fixed 12 months | Any duration |
| **Unlock frequency** | Linear continuous | Configurable periods |
| **Cancel/pause** | Not supported | Supported |
| **Transfer stream** | Not supported | Supported |
| **Multiple recipients** | Separate instructions | Batch support |
| **Dashboard** | None | Built-in |
| **Audited** | Internal review | Third-party audited |
| **Maintenance** | Team responsibility | Streamflow maintains |

### Cost Comparison

| Scenario | Current Custom | Streamflow |
|----------|---------------|------------|
| **Create team vesting** | ~0.01 SOL (rent) | 0.117 SOL + 0.015 SOL |
| **Create founder vesting** | ~0.01 SOL (rent) | 0.117 SOL + 0.015 SOL |
| **Claim (per tx)** | ~0.00001 SOL | ~0.00001 SOL |
| **100 YES voter claims** | ~0.001 SOL total | ~0.65-1.3 SOL (if using distributor) |
| **1000 YES voter claims** | ~0.01 SOL total | ~6.5-13 SOL (if using distributor) |

### Security Comparison

| Aspect | Current Custom | Streamflow |
|--------|---------------|------------|
| **Audit status** | Not audited | Audited by multiple firms |
| **Track record** | New | 5000+ projects, battle-tested |
| **Bug bounty** | None | Active program |
| **Code transparency** | Open source | Open source |

---

## Integration Architecture Options

### Option A: Full Streamflow Migration

Replace all vesting with Streamflow:

```
Market Resolves YES
    ↓
resolve_market (modified)
    ├── Buy tokens from Pump.fun
    ├── Transfer to Streamflow for team vesting
    ├── Transfer to Streamflow for founder SOL
    └── Create Distributor for YES voters
```

**Pros:**
- Unified vesting infrastructure
- Dashboard for all stakeholders
- Reduced maintenance

**Cons:**
- Higher costs for YES voter distribution
- Migration complexity
- External dependency

### Option B: Hybrid Approach (Recommended)

Keep current YES voter distribution, use Streamflow for founder/team:

```
Market Resolves YES
    ↓
resolve_market (modified)
    ↓
├── YES Voters: Keep current claim_rewards (immediate, low cost)
├── Team Vesting: Create Streamflow stream (flexible, audited)
└── Founder Vesting: Create Streamflow stream (flexible, audited)
```

**Pros:**
- Best of both worlds
- Low cost for YES voter claims
- Flexible, audited vesting for team/founder
- Partial dependency

**Cons:**
- Two systems to maintain
- Slightly more complex architecture

### Option C: Keep Current Implementation

No changes, continue with custom vesting.

**Pros:**
- No migration needed
- No external dependencies
- Lowest per-tx costs

**Cons:**
- Fixed vesting parameters
- No cancel/pause capability
- Maintenance burden
- No third-party audit

---

## Implementation Plan (Option B - Hybrid)

### Phase 1: Integration Setup

1. **Install SDK**
   ```bash
   npm install @streamflow/stream @streamflow/common
   ```

2. **Add environment variables**
   ```env
   STREAMFLOW_PROGRAM_ID=strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m
   STREAMFLOW_DEVNET_PROGRAM_ID=HqDGZjaVRXJ9MGRQEw7qDc2rAr6iH1n1kAQdCZaCMfMZ
   ```

3. **Create utility file**
   ```
   src/lib/streamflow.ts
   ```

### Phase 2: Modify Resolution Flow

**Current:**
```
resolve_market → init_team_vesting (custom) → init_founder_vesting (custom)
```

**New:**
```
resolve_market → createTeamVestingStream (Streamflow) → createFounderVestingStream (Streamflow)
```

### Phase 3: Update Smart Contract

Modify `resolve_market.rs`:
- Remove custom vesting initialization
- Transfer tokens/SOL to temporary escrow
- Client-side creates Streamflow streams

Or keep on-chain and use Streamflow CPI (requires Rust SDK integration).

### Phase 4: Frontend Updates

- Add Streamflow dashboard links
- Update claiming UI to use Streamflow SDK
- Show vesting progress from Streamflow API

---

## Code Examples

### Create Team Vesting with Streamflow

```typescript
import { StreamflowSolana, getBN } from "@streamflow/stream";

async function createTeamVesting(
  connection: Connection,
  wallet: WalletAdapter,
  tokenMint: PublicKey,
  teamWallet: PublicKey,
  totalTokens: number,
  immediatePercent: number = 8,
  vestingMonths: number = 12
) {
  const client = new StreamflowSolana.SolanaStreamClient(
    connection.rpcEndpoint
  );

  const decimals = 6; // Pump.fun tokens
  const totalAmount = getBN(totalTokens, decimals);
  const immediateAmount = totalAmount.muln(immediatePercent).divn(100);
  const vestingAmount = totalAmount.sub(immediateAmount);

  const vestingDays = vestingMonths * 30;
  const amountPerDay = vestingAmount.divn(vestingDays);

  const now = Math.floor(Date.now() / 1000);

  const params = {
    recipient: teamWallet.toString(),
    tokenId: tokenMint.toString(),
    start: now,
    amount: totalAmount,
    period: 86400,                    // Daily unlocks
    cliff: now,                       // Immediate cliff
    cliffAmount: immediateAmount,     // 8% at cliff
    amountPerPeriod: amountPerDay,    // Daily vesting
    name: "PLP Team Vesting",
    canTopup: false,
    cancelableBySender: false,        // Cannot cancel
    cancelableByRecipient: false,
    transferableBySender: true,       // Can transfer if needed
    transferableByRecipient: false,
    automaticWithdrawal: false,
  };

  const { tx, metadata } = await client.create(params, { sender: wallet });

  return {
    streamId: metadata.publicKey.toString(),
    transaction: tx,
  };
}
```

### Create Founder SOL Vesting

```typescript
async function createFounderSolVesting(
  connection: Connection,
  wallet: WalletAdapter,
  founderWallet: PublicKey,
  totalSol: number,
  immediatePercent: number = 8,
  vestingMonths: number = 12
) {
  const client = new StreamflowSolana.SolanaStreamClient(
    connection.rpcEndpoint
  );

  // SOL is wrapped to wSOL
  const WSOL_MINT = "So11111111111111111111111111111111111111112";
  const decimals = 9;

  const totalAmount = getBN(totalSol * 1e9, 0); // lamports
  const immediateAmount = totalAmount.muln(immediatePercent).divn(100);
  const vestingAmount = totalAmount.sub(immediateAmount);

  const vestingDays = vestingMonths * 30;
  const amountPerDay = vestingAmount.divn(vestingDays);

  const now = Math.floor(Date.now() / 1000);

  const params = {
    recipient: founderWallet.toString(),
    tokenId: WSOL_MINT,
    start: now,
    amount: totalAmount,
    period: 86400,
    cliff: now,
    cliffAmount: immediateAmount,
    amountPerPeriod: amountPerDay,
    name: "PLP Founder SOL Vesting",
    canTopup: false,
    cancelableBySender: false,
    cancelableByRecipient: false,
    transferableBySender: true,
    transferableByRecipient: false,
    automaticWithdrawal: false,
  };

  const { tx, metadata } = await client.create(params, {
    sender: wallet,
    isNative: true  // Use wSOL
  });

  return {
    streamId: metadata.publicKey.toString(),
    transaction: tx,
  };
}
```

### Claim from Streamflow Stream

```typescript
async function claimFromStream(
  connection: Connection,
  wallet: WalletAdapter,
  streamId: string
) {
  const client = new StreamflowSolana.SolanaStreamClient(
    connection.rpcEndpoint
  );

  const { tx } = await client.withdraw({
    id: streamId,
    amount: getBN(0, 0), // 0 = withdraw all available
  }, {
    invoker: wallet,
  });

  return tx;
}
```

---

## Database Schema Updates

```typescript
// Add to PredictionMarket model
interface PredictionMarket {
  // ... existing fields

  // Streamflow integration
  streamflowTeamVestingId?: string;     // Streamflow stream ID
  streamflowFounderVestingId?: string;  // Streamflow stream ID
  useStreamflow?: boolean;               // Feature flag
}
```

---

## Risk Assessment

### Using Streamflow

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Streamflow downtime** | Low | Medium | Fallback to custom implementation |
| **SDK breaking changes** | Medium | Low | Pin versions, test upgrades |
| **Fee increases** | Low | Low | Budget for higher costs |
| **Program upgrade issues** | Low | High | Monitor Streamflow announcements |

### Keeping Custom

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Security vulnerability** | Medium | Critical | Get audit, bug bounty |
| **Maintenance burden** | High | Medium | Document thoroughly |
| **Feature requests** | High | Medium | Plan development time |
| **User trust** | Medium | Medium | Get third-party audit |

---

## Recommendation

### For MVP: Keep Current Implementation

The current custom vesting works and has lower per-transaction costs. Focus on launching.

### For V2: Hybrid Approach

After launch, migrate founder/team vesting to Streamflow:
1. **Benefits**: Audited, flexible, dashboard, reduced maintenance
2. **Keep**: Custom YES voter claims (cost-effective for many recipients)
3. **Cost**: ~0.25 SOL per market (2 streams × 0.13 SOL)

### Future Consideration: Streamflow Distributor

If YES voter count grows significantly (1000+), consider Streamflow Distributor:
- Merkle tree reduces sender costs
- Recipients pay claim fees
- Built-in clawback for unclaimed tokens

---

## Resources

### Official Documentation
- [Streamflow Platform](https://streamflow.finance/)
- [Streamflow Docs](https://docs.streamflow.finance/)
- [Costs Documentation](https://docs.streamflow.finance/en/articles/9675153-costs-of-using-streamflow)

### SDKs
- [JS SDK (GitHub)](https://github.com/streamflow-finance/js-sdk)
- [JS SDK Docs](https://js-sdk-docs.streamflow.finance/)
- [Rust SDK (GitHub)](https://github.com/streamflow-finance/rust-sdk)
- [@streamflow/stream (npm)](https://www.npmjs.com/package/@streamflow/stream)
- [@streamflow/distributor (npm)](https://www.npmjs.com/package/@streamflow/distributor)

### Examples
- [Stream README](https://github.com/streamflow-finance/js-sdk/blob/master/packages/stream/README.md)
- [Streamflow App](https://app.streamflow.finance/)

---

## Conclusion

| Use Case | Recommendation |
|----------|----------------|
| **YES voter rewards (65%)** | Keep custom `claim_rewards` - immediate, low cost |
| **Team vesting (33%)** | Consider Streamflow - flexible, audited |
| **Founder SOL vesting** | Consider Streamflow - flexible, audited |
| **Platform tokens (2%)** | Keep custom - immediate, simple |
| **Large-scale airdrops** | Use Streamflow Distributor when needed |

The hybrid approach offers the best balance: keep efficient custom code for high-volume, immediate distributions while leveraging Streamflow's battle-tested infrastructure for the more complex vesting scenarios that benefit from flexibility and auditability.
