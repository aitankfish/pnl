# PLP x Arcium: Privacy Layer Implementation Plan

## Blind Voting Model — Users See Progress & Count, Not Which Side Is Winning

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What We Encrypt vs Keep Public](#2-what-we-encrypt-vs-keep-public)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1: Project Setup & Arcium Integration](#4-phase-1-project-setup--arcium-integration)
5. [Phase 2: Encrypted Voting (buy_yes / buy_no)](#5-phase-2-encrypted-voting-buy_yes--buy_no)
6. [Phase 3: Confidential Resolution](#6-phase-3-confidential-resolution)
7. [Phase 4: Private Claim Distribution](#7-phase-4-private-claim-distribution)
8. [Phase 5: Frontend Integration](#8-phase-5-frontend-integration)
9. [Cost Analysis](#9-cost-analysis)
10. [Migration Strategy](#10-migration-strategy)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Timeline](#12-timeline)
13. [Open Questions for Arcium Team](#13-open-questions-for-arcium-team)

---

## 1. Executive Summary

### The Problem

Today, every PLP prediction market vote is fully transparent on-chain:
- Anyone can see **who** voted YES or NO
- Anyone can see **how much** each user staked
- Anyone can see **which side is winning** in real-time
- Whales can be identified and copy-traded
- NO voters can be socially targeted by founders
- Users bandwagon onto the winning side instead of voting on conviction
- Front-running is trivial — watch the mempool, see large YES votes, follow

### The Solution: Blind Voting

Integrate Arcium's MPC-based confidential computing to create a **blind voting model**:

- Users see **total SOL raised** (progress toward target) and **voter count**
- Users **cannot** see which side is winning (YES vs NO ratio hidden)
- Users **cannot** see who voted what or how much
- The AMM runs **inside MPC** — pool ratios stay encrypted until resolution
- At resolution, only the **outcome** is revealed (YesWins/NoWins/Refund)
- Individual positions remain encrypted even after resolution

### Why Blind Voting?

The whole point of PLP is **honest community validation**. If users can see "YES is at 72%", they pile on. Blind voting forces users to evaluate the **project itself**, not the crowd sentiment. This produces:

- **Higher quality signals** — votes reflect conviction, not bandwagoning
- **Fairer outcomes** — small voters aren't influenced by whale moves
- **No front-running** — can't front-run what you can't see
- **No social pressure** — NO voters protected from retaliation
- **True prediction market** — the final outcome is the genuine crowd wisdom, not a feedback loop

---

## 2. What We Encrypt vs Keep Public

### Stays Public

| Data | Why Public |
|------|-----------|
| Market metadata (IPFS CID, name, description) | Users must evaluate projects to vote |
| Market expiry time | Users need to know the deadline |
| Market phase (Prediction/Funding) | UX requirement |
| **Total pool balance** (SOL raised) | Users see progress: "7.3 / 10 SOL (73%)" |
| **Total voter count** | Users see engagement: "43 voters" |
| Market resolution outcome (YesWins/NoWins/Refund) | Must be verifiable after market ends |
| Token mint address (post-launch) | Users need to find the launched token |
| Platform fee rates (1.5%, 5%) | Transparency on fees |
| Market creation fee (0.015 SOL) | Must be known upfront |
| Target pool amount (5/10/15 SOL) | Users need to know the goal |

### Encrypted (Hidden Until Resolution or Forever)

| Data | Privacy Level | When Revealed |
|------|-------------|---------------|
| YES/NO pool ratio (AMM state) | Fully encrypted | **Never** — only the outcome is revealed |
| YES/NO price / probability | Fully encrypted | **Never** — no price display during voting |
| Individual vote direction (YES or NO) | Fully encrypted | **Never** — even after resolution |
| Individual stake amount | Fully encrypted | **Never** — even after resolution |
| Per-user share count | Fully encrypted | Only to the user themselves (self-decrypt) |
| Total YES shares vs Total NO shares | Encrypted during voting | Revealed at resolution (needed for claims) |
| Individual claim amounts | Encrypted | Computed via MPC at claim time |

### What Users See During Active Market

```
┌─────────────────────────────────────────────┐
│  🔮 Project: DeFi Lending Protocol          │
│                                             │
│  Pool Progress: ████████░░░░ 7.3 / 10 SOL  │
│  Voters: 43                                 │
│  Time Left: 4 days 12 hours                 │
│                                             │
│  Your Status: You have voted ✓              │
│  (Your position is encrypted)               │
│                                             │
│  [Vote YES]     [Vote NO]                   │
│                                             │
│  ⚠️ Voting is blind — you cannot see        │
│  which side is winning until the market      │
│  resolves. Vote based on your conviction.    │
└─────────────────────────────────────────────┘
```

### What Users See After Resolution

```
┌─────────────────────────────────────────────┐
│  🎉 Project: DeFi Lending Protocol          │
│  RESULT: YES WINS — Token Launched!         │
│                                             │
│  Final Tally: 62% YES / 38% NO             │
│  Total Pool: 10.0 SOL (target reached)      │
│  Voters: 43                                 │
│  Token: $DEFI (mint: 7x3k...)              │
│                                             │
│  Your Position: (decrypt to view)           │
│  [Claim Rewards]                            │
└─────────────────────────────────────────────┘
```

---

## 3. Architecture Overview

### Current Architecture (No Privacy)

```
User calls buy_yes(2 SOL)
  → Position PDA: { user: 0xABC, yes_shares: 450, invested: 2 SOL }     ← VISIBLE
  → Market PDA: { yes_pool: -, no_pool: +, total_yes_shares: + }        ← VISIBLE (ratio exposed)
  → Market Vault: +1.97 SOL                                              ← VISIBLE
  → Anyone can see: "0xABC put 2 SOL on YES, YES now at 72%"
```

### New Architecture (Blind Voting)

```
User encrypts vote locally → calls buy_yes(2 SOL, ciphertexts, pubkey, nonce)
  │
  ├─ PUBLIC ON-CHAIN (immediate):
  │   ├─ Fee: 1.5% → Treasury
  │   ├─ SOL: 98.5% → Market Vault
  │   ├─ pool_balance += net SOL              ← PUBLIC: "pool grew by ~1.97 SOL"
  │   ├─ voter_count += 1                     ← PUBLIC: "now 44 voters"
  │   └─ Arcium CPI: queue_computation()
  │
  ├─ ENCRYPTED MPC (Arcium cluster, ~2-5s):
  │   ├─ Decrypt user's vote inside MPC (no node sees plaintext)
  │   ├─ Read encrypted AMM state (yes_pool, no_pool)
  │   ├─ Calculate shares: k = x * y, shares = x_old - (k / (y + sol))
  │   ├─ Update encrypted AMM pools
  │   ├─ Update encrypted vote tally (total_yes_shares, total_no_shares)
  │   ├─ Encrypt position for user
  │   └─ Sign results collectively
  │
  └─ CALLBACK (on-chain, automatic):
      ├─ Store encrypted position → EncryptedPosition PDA
      ├─ Store encrypted AMM state → EncryptedAMMState PDA
      └─ Store encrypted tally → EncryptedMarketTally PDA
```

### System Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER CLIENT                                 │
│                                                                          │
│  1. User evaluates project (metadata, team, idea)                       │
│  2. User decides YES or NO based on conviction (no crowd signal)        │
│  3. Client encrypts: { direction, amount } with X25519 + Rescue cipher  │
│  4. Client submits encrypted vote transaction                           │
│                                                                          │
│         Encrypted TX: buy_yes(sol, ciphertexts, pubkey, nonce)          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         PLP SOLANA PROGRAM (v2)                          │
│                                                                          │
│  ┌────────────────────────┐    ┌─────────────────────────────────────┐  │
│  │  PUBLIC LAYER            │    │  PRIVATE LAYER (Arcium CPI)         │  │
│  │                          │    │                                     │  │
│  │  • Validate: not expired │    │  • queue_computation()              │  │
│  │  • Validate: sol >= min  │    │    → encrypted vote data            │  │
│  │  • Deduct 1.5% fee      │    │    → encrypted AMM state (Mxe)      │  │
│  │  • Transfer SOL to vault│    │    → encrypted tally (Mxe)           │  │
│  │  • pool_balance += sol   │    │    → callback accounts              │  │
│  │  • voter_count += 1      │    │                                     │  │
│  │                          │    │  Circuits:                          │  │
│  │  NO: yes_pool, no_pool   │    │  • process_vote (AMM + position)   │  │
│  │  NO: total_yes/no_shares │    │  • resolve_tally (determine winner)│  │
│  │  NO: price display       │    │  • calculate_claim (reward math)   │  │
│  └────────────────────────┘    └─────────────────────────────────────┘  │
│                                                                          │
│  ON-CHAIN STATE:                                                        │
│  ┌─────────────────┐ ┌──────────────────┐ ┌─────────────────────────┐  │
│  │ Market PDA       │ │ EncryptedAMM PDA │ │ EncryptedPosition PDA   │  │
│  │ (PUBLIC fields:  │ │ (ENCRYPTED:      │ │ (ENCRYPTED per-user:    │  │
│  │  pool_balance,   │ │  yes_pool,       │ │  yes_shares, no_shares, │  │
│  │  voter_count,    │ │  no_pool,        │ │  total_invested)        │  │
│  │  expiry, phase,  │ │  k_constant)     │ │                         │  │
│  │  resolution)     │ │                  │ │ EncryptedTally PDA      │  │
│  │                  │ │                  │ │ (ENCRYPTED:             │  │
│  │                  │ │                  │ │  total_yes, total_no)   │  │
│  └─────────────────┘ └──────────────────┘ └─────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ CPI
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    ARCIUM PROGRAM + MPC CLUSTER                          │
│                                                                          │
│  Arcium Program (on-chain):                                             │
│  • Queue computation → mempool                                          │
│  • Assign to cluster                                                    │
│  • Deliver signed callback                                              │
│                                                                          │
│  MPC Cluster (off-chain, 4+ Arx nodes):                                │
│  • Each node holds secret shares (no node sees plaintext)               │
│  • Cerberus protocol: secure if ≥1 node is honest                      │
│  • Executes AMM math on encrypted data                                  │
│  • Returns encrypted results signed by cluster                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase 1: Project Setup & Arcium Integration

### 4.1 Tooling Migration

Replace `anchor` CLI with `arcium` CLI (superset of Anchor):

```bash
# Install Arcium CLI
cargo install arcium-cli

# Initialize Arcium in existing project
cd plp-platform/plp_program
arcium init --existing
```

New project structure:
```
plp_program/
├── Arcium.toml                       # NEW: Arcium configuration
├── encrypted-ixs/                    # NEW: Arcis MPC circuit code
│   └── src/
│       └── lib.rs                    # 3 circuits: process_vote, resolve_tally, calculate_claim
├── programs/
│   └── errors/                       # EXISTING: Anchor program (modified)
│       └── src/
│           ├── lib.rs                # Add #[arcium_program], new instructions
│           ├── instructions/
│           │   ├── buy_yes.rs        # MODIFIED: public layer only, triggers Arcium CPI
│           │   ├── buy_no.rs         # MODIFIED: same pattern
│           │   ├── vote_callback.rs  # NEW: receives MPC result, stores encrypted state
│           │   ├── resolve_market.rs # MODIFIED: triggers MPC tally
│           │   ├── resolve_callback.rs # NEW: receives resolution result
│           │   ├── claim_rewards.rs  # MODIFIED: triggers MPC claim calc
│           │   ├── claim_callback.rs # NEW: receives claim amount, transfers funds
│           │   ├── init_comp_defs.rs # NEW: one-time circuit registration
│           │   └── ...              # Other instructions UNCHANGED
│           └── state/
│               ├── market.rs         # MODIFIED: remove AMM fields, add voter_count
│               ├── encrypted_amm.rs  # NEW: encrypted AMM state
│               ├── encrypted_position.rs # NEW: replaces position.rs
│               ├── encrypted_tally.rs    # NEW: encrypted vote totals
│               ├── treasury.rs       # UNCHANGED
│               ├── team_vesting.rs   # UNCHANGED
│               └── founder_vesting.rs # UNCHANGED
└── tests/
```

### 4.2 MXE Configuration

One persistent MXE for the entire PLP platform:

```
MXE Configuration:
  - Type: Recurring (persistent, reusable across all markets)
  - Protocol: Cerberus (dishonest majority — strongest security)
  - Access: Public (any user can submit encrypted votes)
  - Cluster: Mainnet Alpha cluster (coordinate with Arcium team)
  - Recovery Set Size: 4 (minimum for mainnet)
```

### 4.3 New On-Chain Accounts

| Account | Seeds | Size | Purpose |
|---------|-------|------|---------|
| EncryptedAMMState | `["enc_amm", market]` | ~170 bytes | Encrypted yes_pool, no_pool, k_constant per market |
| EncryptedPosition | `["enc_position", market, user]` | ~220 bytes | Encrypted per-user position |
| EncryptedMarketTally | `["enc_tally", market]` | ~130 bytes | Encrypted running vote totals |
| Sign PDA | `[SIGN_PDA_SEED]` | (Arcium-managed) | PLP program's signing authority for CPI |
| Computation Definitions | (Arcium PDAs) | (Arcium-managed) | One per circuit (3 total) |

### 4.4 Dependencies

Rust (`Cargo.toml`):
```toml
[dependencies]
arcium-anchor = { version = "0.8" }
arcium-macros = { version = "0.8" }
```

TypeScript (`package.json`):
```json
{
  "@arcium-hq/client": "^0.8",
  "@noble/curves": "^1.0"
}
```

### 4.5 One-Time Initialization

After deployment, call these once:
1. `init_process_vote_comp_def()` — Register the voting circuit
2. `init_resolve_tally_comp_def()` — Register the resolution circuit
3. `init_calculate_claim_comp_def()` — Register the claim circuit

---

## 5. Phase 2: Encrypted Voting (buy_yes / buy_no)

### 5.1 Arcis Circuit — process_vote

This is the core MPC circuit. It does what `buy_yes`/`buy_no` currently do publicly (AMM math + position tracking), but entirely on encrypted data:

```rust
// encrypted-ixs/src/lib.rs

#[encrypted]
mod circuits {
    use arcis::*;

    // === STRUCTS ===

    /// User's encrypted vote input
    pub struct VoteInput {
        vote_direction: u8,    // 1 = YES, 2 = NO
        net_sol_amount: u64,   // SOL after 1.5% fee (in lamports)
    }

    /// AMM state (encrypted, MXE-owned, persistent per market)
    pub struct AMMState {
        yes_pool: u64,         // AMM YES reserves (scaled 1e9)
        no_pool: u64,          // AMM NO reserves (scaled 1e9)
        k_constant: u128,      // x * y = k (invariant)
    }

    /// Per-user position (encrypted, user-owned)
    pub struct PositionState {
        yes_shares: u64,
        no_shares: u64,
        total_invested: u64,
    }

    /// Running vote tally (encrypted, MXE-owned)
    pub struct TallyState {
        total_yes_shares: u64,
        total_no_shares: u64,
    }

    /// Public output: only voter_count increment confirmation
    pub struct VoteConfirmation {
        success: u8,           // 1 = success, 0 = failed (e.g., insufficient liquidity)
        shares_received: u64,  // Encrypted, only user can read
    }

    // === CIRCUIT ===

    #[instruction]
    pub fn process_vote(
        vote_input: Enc<Shared, VoteInput>,       // User's encrypted vote
        amm_state: Enc<Mxe, AMMState>,            // Current encrypted AMM (MXE reads)
        tally_state: Enc<Mxe, TallyState>,        // Current encrypted tally (MXE reads)
    ) -> (
        Enc<Shared, PositionState>,                // User's encrypted position (user decrypts)
        Enc<Mxe, AMMState>,                        // Updated AMM state (MXE stores)
        Enc<Mxe, TallyState>,                      // Updated tally (MXE stores)
    ) {
        let input = vote_input.to_arcis();
        let mut amm = amm_state.to_arcis();
        let mut tally = tally_state.to_arcis();

        let sol = input.net_sol_amount;
        let is_yes = input.vote_direction == 1u8;

        // ---- Constant Product AMM: x * y = k ----
        //
        // Buy YES: user adds SOL to no_pool, receives shares from yes_pool
        //   y_new = y_old + sol
        //   x_new = k / y_new
        //   shares = x_old - x_new
        //
        // Buy NO: user adds SOL to yes_pool, receives shares from no_pool
        //   x_new = x_old + sol
        //   y_new = k / x_new
        //   shares = y_old - y_new

        // Calculate shares for YES vote
        let yes_new_no_pool = amm.no_pool + sol;
        let yes_new_yes_pool = (amm.k_constant / yes_new_no_pool as u128) as u64;
        let yes_shares = amm.yes_pool - yes_new_yes_pool;

        // Calculate shares for NO vote
        let no_new_yes_pool = amm.yes_pool + sol;
        let no_new_no_pool = (amm.k_constant / no_new_yes_pool as u128) as u64;
        let no_shares = amm.no_pool - no_new_no_pool;

        // Select result based on direction (both branches execute in MPC)
        let final_shares = if is_yes { yes_shares } else { no_shares };

        // Update AMM state
        if is_yes {
            amm.yes_pool = yes_new_yes_pool;
            amm.no_pool = yes_new_no_pool;
        } else {
            amm.yes_pool = no_new_yes_pool;
            amm.no_pool = no_new_no_pool;
        }
        // k_constant stays the same (constant product invariant)

        // Build user position
        let position = PositionState {
            yes_shares: if is_yes { final_shares } else { 0u64 },
            no_shares: if is_yes { 0u64 } else { final_shares },
            total_invested: sol,
        };

        // Update tally
        if is_yes {
            tally.total_yes_shares = tally.total_yes_shares + final_shares;
        } else {
            tally.total_no_shares = tally.total_no_shares + final_shares;
        }

        (
            vote_input.owner.from_arcis(position),   // Encrypted for user
            Mxe::get().from_arcis(amm),              // Encrypted for MXE
            Mxe::get().from_arcis(tally),            // Encrypted for MXE
        )
    }
}
```

### 5.2 Circuit Complexity Analysis

| Operation | Type | Cost |
|-----------|------|------|
| `input.vote_direction == 1u8` | Comparison | Expensive |
| `amm.no_pool + sol` | Addition | Cheap |
| `amm.k_constant / yes_new_no_pool` | Division | Very expensive |
| `amm.yes_pool - yes_new_yes_pool` | Subtraction | Cheap |
| `if is_yes { ... } else { ... }` | Conditional (both branches execute) | 2x the branch cost |
| `tally + shares` | Addition | Cheap |

The division is the most expensive operation. We execute it twice (once for each branch of the conditional). Total: **2 divisions, 2 comparisons, ~8 additions**. This is a medium-weight circuit.

### 5.3 Modified Market State

Remove AMM fields from Market (they move to EncryptedAMMState):

```rust
pub struct Market {
    pub founder: Pubkey,
    pub ipfs_cid: String,
    pub target_pool: u64,
    pub pool_balance: u64,                 // KEEP PUBLIC — progress tracking
    pub voter_count: u32,                  // NEW PUBLIC — replaces individual tracking
    pub distribution_pool: u64,            // Set at resolution
    // REMOVED: yes_pool, no_pool (now encrypted)
    // REMOVED: total_yes_shares, total_no_shares (now encrypted)
    pub total_yes_shares: u64,             // SET AT RESOLUTION ONLY (0 until then)
    pub total_no_shares: u64,              // SET AT RESOLUTION ONLY (0 until then)
    pub expiry_time: i64,
    pub phase: MarketPhase,
    pub resolution: MarketResolution,
    pub metadata_uri: String,
    pub token_mint: Option<Pubkey>,
    pub platform_tokens_allocated: u64,
    pub platform_tokens_claimed: bool,
    pub yes_voter_tokens_allocated: u64,
    pub founder_excess_sol_allocated: u64,
    pub founder_vesting_initialized: bool,
    pub treasury: Pubkey,
    pub enc_amm: Pubkey,                   // NEW — reference to EncryptedAMMState PDA
    pub enc_tally: Pubkey,                 // NEW — reference to EncryptedMarketTally PDA
    pub bump: u8,
}
```

### 5.4 New State: EncryptedAMMState PDA

```rust
pub struct EncryptedAMMState {
    pub market: Pubkey,                    // Which market this AMM belongs to
    pub encrypted_state: [u8; 128],        // ENCRYPTED: [yes_pool(u64), no_pool(u64), k_constant(u128)]
                                           // 2 x 32-byte + 1 x 64-byte ciphertexts
    pub nonce: u128,                       // MXE encryption nonce
    pub bump: u8,
}
// Seeds: ["enc_amm", market]
// Initialized at create_market with encrypted initial state
```

### 5.5 New State: EncryptedPosition PDA

```rust
pub struct EncryptedPosition {
    pub user: Pubkey,                      // PUBLIC: position owner
    pub market: Pubkey,                    // PUBLIC: which market
    pub encrypted_data: [u8; 96],          // ENCRYPTED: [yes_shares, no_shares, total_invested]
    pub encryption_key: [u8; 32],          // User's X25519 public key
    pub nonce: u128,                       // Encryption nonce
    pub has_position: bool,                // PUBLIC: user has voted (direction hidden)
    pub claimed: bool,                     // PUBLIC: prevents double-claim
    pub bump: u8,
}
// Seeds: ["enc_position", market, user]
```

### 5.6 New State: EncryptedMarketTally PDA

```rust
pub struct EncryptedMarketTally {
    pub market: Pubkey,
    pub encrypted_tally: [u8; 64],         // ENCRYPTED: [total_yes_shares, total_no_shares]
    pub nonce: u128,
    pub bump: u8,
}
// Seeds: ["enc_tally", market]
```

### 5.7 Modified buy_yes / buy_no Flow

Both instructions now follow the same pattern — the only difference is what the user encrypts client-side (direction = 1 vs 2). The on-chain instruction doesn't even know which side:

```
buy_vote(sol_amount, ciphertexts, pub_key, nonce)
  │
  ├─ PUBLIC ON-CHAIN (immediate, same transaction):
  │   ├─ Validate market not expired, not resolved
  │   ├─ Validate sol_amount >= MIN_INVESTMENT (0.01 SOL)
  │   ├─ Validate user has no existing EncryptedPosition for this market
  │   ├─ Calculate 1.5% fee → transfer to Treasury PDA
  │   ├─ Transfer net SOL (98.5%) → Market Vault PDA
  │   ├─ market.pool_balance += net_sol
  │   ├─ market.voter_count += 1
  │   ├─ Pre-create EncryptedPosition PDA (empty, for callback to fill)
  │   └─ Arcium CPI: queue_computation(process_vote, args, callback_accounts)
  │
  ├─ ARCIUM MPC (off-chain, ~2-5 seconds):
  │   ├─ Cluster picks up computation from mempool
  │   ├─ Decrypts user vote + AMM state + tally as secret shares
  │   ├─ Runs AMM math (constant product) on secret shares
  │   ├─ Calculates user's shares
  │   ├─ Updates AMM pools + tally
  │   ├─ Encrypts results: position for user, AMM + tally for MXE
  │   └─ Signs output collectively
  │
  └─ CALLBACK (on-chain, automatic):
      ├─ verify_output(cluster_account, computation_account)
      ├─ Write encrypted position → EncryptedPosition PDA
      ├─ Write encrypted AMM state → EncryptedAMMState PDA
      └─ Write encrypted tally → EncryptedMarketTally PDA
```

### 5.8 One-Position Rule Enforcement

Currently we check `position.no_shares == 0` before allowing `buy_yes`. With blind voting:

- The on-chain instruction checks `EncryptedPosition.has_position == false`
- Since `has_position` is public and set to `true` after the first vote, a second vote is rejected
- The **direction** is NOT leaked — we just know "this user already voted"
- This is stricter than current behavior (can't add to an existing position), but simpler and more private

If we want to allow users to add to their existing position (same direction only), we can:
- Pass the existing encrypted position into the MPC circuit
- The circuit checks direction matches internally
- Returns error output if mismatch
- This is a Phase 2 enhancement

### 5.9 Pool Capping (Prediction Phase)

Currently, in Prediction phase, votes are capped so pool_balance doesn't exceed target_pool. With encrypted AMM:

- `pool_balance` is still public, so we can check `pool_balance + sol_amount <= target_pool` on-chain
- If it would exceed, cap the SOL amount on-chain BEFORE sending to MPC
- The MPC circuit doesn't need to handle capping — it just processes whatever SOL it receives

### 5.10 AMM Initialization

At `create_market`, we initialize the encrypted AMM state:

```
create_market():
  ...existing logic...

  // Initialize encrypted AMM via Arcium
  // Initial state: yes_pool = target_pool, no_pool = target_pool, k = target^2
  // This needs a simple init circuit or can be done by encrypting
  // the initial state directly with the MXE public key

  queue_computation(init_amm, initial_state)
  → Callback stores encrypted AMM state
```

Alternatively, if Arcium supports direct MXE encryption from the client (without a circuit), we can encrypt the initial AMM state client-side using the MXE public key and store it directly. This avoids an MPC call for initialization.

---

## 6. Phase 3: Confidential Resolution

### 6.1 Arcis Circuit — resolve_tally

```rust
#[instruction]
pub fn resolve_tally(
    encrypted_tally: Enc<Mxe, TallyState>,    // Encrypted vote totals
    target_pool: u64,                           // Plaintext — public
    pool_balance: u64,                          // Plaintext — public
) -> (u8, u64, u64) {
    // Returns plaintext — resolution is meant to be public

    let tally = encrypted_tally.to_arcis();

    // Same logic as current resolve_market
    let resolution: u8 = if pool_balance < target_pool {
        3  // Refund (target not reached)
    } else if tally.total_yes_shares > tally.total_no_shares {
        1  // YesWins
    } else if tally.total_no_shares > tally.total_yes_shares {
        2  // NoWins
    } else {
        3  // Refund (tie)
    };

    // Reveal totals (market is over — this is safe)
    // These are needed for proportional claim calculations
    let total_yes = tally.total_yes_shares.reveal();
    let total_no = tally.total_no_shares.reveal();
    let res = resolution.reveal();

    (res, total_yes, total_no)
}
```

### 6.2 Modified resolve_market Flow

```
resolve_market()
  │
  ├─ VALIDATE (on-chain):
  │   ├─ Market expired (or founder in Funding phase, or pool full + conditions)
  │   ├─ Market still Unresolved
  │   └─ Cannot determine winner on-chain — AMM is encrypted
  │
  ├─ ARCIUM CPI:
  │   ├─ queue_computation(resolve_tally, encrypted_tally, target_pool, pool_balance)
  │   └─ Callback: resolve_market_callback
  │
  └─ CALLBACK (resolve_market_callback):
      ├─ verify_output → get (resolution, total_yes, total_no)
      ├─ market.resolution = YesWins / NoWins / Refund
      ├─ market.total_yes_shares = total_yes     (NOW public — market is over)
      ├─ market.total_no_shares = total_no       (NOW public — market is over)
      │
      ├─ IF YesWins:
      │   ├─ Calculate 5% completion fee → Treasury
      │   ├─ Cap SOL at 50 for token launch
      │   ├─ Pump.fun Buy CPI (UNCHANGED)
      │   ├─ Allocate tokens: 2% platform + 33% team + 65% voters
      │   └─ Store excess SOL for founder vesting
      │
      ├─ IF NoWins:
      │   ├─ Calculate 5% completion fee → Treasury
      │   └─ Set distribution_pool for NO voter claims
      │
      └─ IF Refund:
          └─ Transfer all vault SOL to market (no fees)
```

### 6.3 The Pump.fun CPI Challenge

The `resolve_market` callback needs to execute the Pump.fun Buy CPI (token creation). This is complex because:

1. Callback instructions have limited compute budget
2. The Pump.fun CPI requires many accounts (bonding curve, mint, associated token accounts)
3. Callback accounts must be pre-created during the queue instruction

**Solution**: Split resolution into two transactions:

```
TX 1: resolve_market()
  → queue_computation(resolve_tally)
  → Callback: store resolution result in Market PDA

TX 2: finalize_resolution()
  → Read market.resolution (now public)
  → Execute Pump.fun CPI (if YesWins) — same as current code
  → Fee calculations, token allocations — same as current code
```

This keeps the Arcium callback simple (just write the resolution) and the Pump.fun CPI in a separate, standard Solana transaction.

---

## 7. Phase 4: Private Claim Distribution

### 7.1 Arcis Circuit — calculate_claim

```rust
#[instruction]
pub fn calculate_claim(
    encrypted_position: Enc<Shared, PositionState>,    // User's encrypted position
    resolution: u8,                                     // Plaintext (public after resolution)
    total_yes_shares: u64,                              // Plaintext (public after resolution)
    total_no_shares: u64,                               // Plaintext (public after resolution)
    yes_voter_tokens_allocated: u64,                    // Plaintext (public)
    distribution_pool: u64,                             // Plaintext (public, NoWins only)
) -> (u64, u8) {
    // Returns plaintext — claim amount must be known to execute transfer

    let pos = encrypted_position.to_arcis();

    let claim_amount: u64;
    let claim_type: u8;

    if resolution == 1u8 {
        // YesWins: tokens = (user_yes_shares * total_tokens) / total_yes_shares
        claim_amount = ((pos.yes_shares as u128 * yes_voter_tokens_allocated as u128)
                       / total_yes_shares as u128) as u64;
        claim_type = 1u8;  // Tokens
    } else if resolution == 2u8 {
        // NoWins: sol = (user_no_shares * distribution_pool) / total_no_shares
        claim_amount = ((pos.no_shares as u128 * distribution_pool as u128)
                       / total_no_shares as u128) as u64;
        claim_type = 2u8;  // SOL
    } else {
        // Refund: 98.5% of invested
        claim_amount = (pos.total_invested * 9850u64) / 10000u64;
        claim_type = 3u8;  // Refund SOL
    }

    (claim_amount.reveal(), claim_type.reveal())
}
```

### 7.2 Modified claim_rewards Flow

```
claim_rewards()
  │
  ├─ VALIDATE (on-chain):
  │   ├─ Market resolved
  │   ├─ EncryptedPosition exists, has_position == true
  │   ├─ claimed == false
  │   └─ User is the position owner
  │
  ├─ ARCIUM CPI:
  │   ├─ queue_computation(calculate_claim, encrypted_position, resolution_params)
  │   └─ Callback: claim_rewards_callback
  │
  └─ CALLBACK (claim_rewards_callback):
      ├─ verify_output → get (claim_amount, claim_type)
      │
      ├─ IF claim_type == 1 (Tokens):
      │   └─ Transfer claim_amount tokens from market token account to user
      │
      ├─ IF claim_type == 2 (SOL — NoWins):
      │   └─ Transfer claim_amount SOL from market to user
      │
      ├─ IF claim_type == 3 (Refund SOL):
      │   └─ Transfer claim_amount SOL from market to user
      │
      ├─ Mark position.claimed = true
      └─ Emit ClaimEvent { user, market, claim_type }  (amount omitted for privacy)
```

### 7.3 Claim Privacy Note

The actual SOL/token transfer is visible on-chain. Observers CAN see the final claim amount from the transfer. However:

- They cannot see the position BEFORE the claim (direction + amount hidden)
- They cannot front-run claims (callback is atomic)
- The transfer amount alone doesn't reveal whether the user voted YES or NO in the Refund case (everyone gets refunded)
- For YesWins/NoWins, knowing the claim amount + public totals could theoretically reveal the share count, but this is post-resolution and the market is over

For stronger post-resolution privacy, C-SPL (Confidential SPL Token) transfers would hide claim amounts entirely. This is a future enhancement once C-SPL is available.

---

## 8. Phase 5: Frontend Integration

### 8.1 Client-Side Encryption

New file: `src/lib/arcium/encryption.ts`

```typescript
import { x25519 } from '@noble/curves/ed25519';
import { RescueCipher, getMXEPublicKey, randomBytes } from '@arcium-hq/client';

/**
 * Encrypt a vote for submission to the PLP program.
 * The direction and amount are encrypted — only the MPC cluster
 * can read them, and no single node sees the plaintext.
 */
async function encryptVote(
  connection: Connection,
  mxeProgramId: PublicKey,
  walletPublicKey: PublicKey,
  voteDirection: 'YES' | 'NO',
  netSolLamports: bigint,         // SOL after 1.5% fee
) {
  // 1. Derive deterministic X25519 key from wallet signature
  //    This makes the key recoverable from any device with the same wallet
  const message = `PLP Privacy Key v1`;
  const signature = await wallet.signMessage(Buffer.from(message));
  const privateKey = sha256(signature).slice(0, 32);
  const publicKey = x25519.getPublicKey(privateKey);

  // 2. Get MXE public key
  const mxePublicKey = await getMXEPublicKey(connection, mxeProgramId);

  // 3. Create cipher
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);

  // 4. Encrypt vote data
  const nonce = randomBytes(16);
  const plaintext = [
    BigInt(voteDirection === 'YES' ? 1 : 2),
    netSolLamports,
  ];
  const ciphertexts = cipher.encrypt(plaintext, nonce);

  return {
    ciphertexts,              // Send to on-chain instruction
    publicKey,                // Send to on-chain instruction
    nonce: deserializeLE(nonce),
    cipher,                   // Keep locally for decryption
  };
}
```

### 8.2 Client-Side Position Decryption

```typescript
/**
 * Decrypt the user's own position from the on-chain encrypted PDA.
 * Only the position owner can do this (they have the private key).
 */
async function decryptMyPosition(
  encryptedPositionAccount: EncryptedPosition,
  wallet: WalletAdapter,
  mxePublicKey: Uint8Array,
) {
  // Re-derive the same deterministic key
  const message = `PLP Privacy Key v1`;
  const signature = await wallet.signMessage(Buffer.from(message));
  const privateKey = sha256(signature).slice(0, 32);

  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);

  const decrypted = cipher.decrypt(
    encryptedPositionAccount.encrypted_data,
    encryptedPositionAccount.nonce,
  );

  return {
    yesShares: Number(decrypted[0]),
    noShares: Number(decrypted[1]),
    totalInvested: Number(decrypted[2]),
  };
}
```

### 8.3 Frontend UX Changes

| Feature | Current UX | Blind Voting UX |
|---------|-----------|-----------------|
| **Market page** | Shows YES/NO prices, pool ratios | Shows only total SOL raised + voter count |
| **Price chart** | YES/NO probability over time | **Removed** — no price data during voting |
| **Progress bar** | Shows YES/NO split visually | Shows only total SOL toward target |
| **Voting** | Instant confirmation | ~2-5s delay (MPC), show spinner with "Encrypting your vote..." |
| **Your position** | Plaintext on-chain | Decrypt locally — only you can see your shares |
| **Other positions** | Visible to anyone | Hidden — shows "Encrypted" badge |
| **Activity feed** | "0xABC voted 2 SOL YES" | "A user voted on this market" (no details) |
| **Resolution** | Instant, outcome visible | ~2-5s delay (MPC tally), then outcome revealed |
| **Post-resolution** | Shows final YES/NO split | Shows final YES/NO split + "Your position" (self-decrypt) |
| **Claiming** | Instant | ~2-5s delay (MPC calculation) |
| **Leaderboard** | By position size | By markets participated (no amounts) |

### 8.4 New UI Components

1. **BlindVoteCard** — Replaces the current market card with price display. Shows project info, pool progress bar (total only), voter count, and blind vote buttons.

2. **EncryptedPositionBadge** — Shows "Your vote is encrypted" with a decrypt button that triggers local decryption.

3. **VotePendingSpinner** — Shows "Encrypting and submitting your vote..." during the MPC processing window.

4. **ResolutionReveal** — Animated reveal of the outcome when MPC tally completes. Shows the final YES/NO percentage for the first time.

### 8.5 Key Derivation Strategy

**Deterministic wallet-based key** (recommended):

```
User signs: "PLP Privacy Key v1"
→ SHA-256(signature) → X25519 private key
→ Same wallet = same key = position always recoverable
→ No local storage needed
→ Works across devices
→ One key per wallet (not per market — simpler)
```

Why not per-market keys?
- Users would need to sign for every market they've voted on
- Simplicity > marginal security gain
- The key is derived from the wallet — if the wallet is compromised, privacy is lost anyway

---

## 9. Cost Analysis

### 9.1 Per-Vote Cost Comparison

| Cost Component | Current (No Privacy) | With Blind Voting |
|---|---|---|
| Solana base tx fee | ~5,000 lamports | ~5,000 lamports |
| Position PDA rent | ~1,600,000 lamports | ~2,500,000 lamports (larger encrypted PDA) |
| Trade fee (1.5%) | Deducted from amount | Deducted from amount (unchanged) |
| Arcium MPC computation | N/A | **TBD** — CU-based, paid in ARC tokens |
| Arcium priority fee | N/A | Optional (for faster execution) |
| **Approx total overhead** | **~0.002 SOL** | **~0.003-0.005 SOL + ARC fee** |

### 9.2 Per-Market Arcium Computation Count

| Event | Computations | Circuit |
|---|---|---|
| Market creation (AMM init) | 1 | `init_amm` (simple, one-time) |
| Each vote | 1 | `process_vote` (AMM math + position) |
| Market resolution | 1 | `resolve_tally` (comparison) |
| Each claim | 1 | `calculate_claim` (division) |

**Example**: Market with 50 voters, YES wins, all claim:
- 1 init + 50 votes + 1 resolution + 50 claims = **102 Arcium computations**

### 9.3 Circuit Weight Comparison

| Circuit | Key Operations | Relative Cost |
|---|---|---|
| `init_amm` | Encryption only, no math | Very low |
| `process_vote` | 2 divisions, 2 comparisons, ~8 additions | **Medium-High** (divisions dominate) |
| `resolve_tally` | 3 comparisons, 2 reveals | Low |
| `calculate_claim` | 1 division, 1 comparison, 1 reveal | Medium |

### 9.4 Cost Optimization Strategies

1. **Batch votes** — Accumulate 5-10 votes, process in one MPC call with a fixed-size array input. Amortizes overhead. Adds 10-30s latency (batch window).

2. **Pre-compute claims at resolution** — Instead of N separate claim computations, batch all positions into one MPC call. Requires fixed-size array (max 500 voters per market?). Saves N-1 MPC calls.

3. **Simplify AMM in circuit** — Replace division with multiplication-based checks where possible. E.g., instead of `shares = k / y_new`, use `shares * y_new = k` as a verification.

4. **Absorb ARC fees** — Platform pays ARC fees from the 1.5% trade fee revenue. Users don't need to hold ARC tokens.

### 9.5 Minimum Trade Consideration

For 0.01 SOL minimum trade:
- Current overhead: ~0.002 SOL (20%)
- With Arcium: ~0.004 SOL + ARC (40%+)

**Options**:
- Increase minimum to 0.05 SOL for blind voting markets (overhead drops to ~8%)
- Keep 0.01 SOL minimum but absorb Arcium fees into platform revenue
- Make blind voting optional per market (founder chooses at creation)

---

## 10. Migration Strategy

### 10.1 Approach: Deploy PLP v2 Alongside v1

```
Current:  PLP v1 (Program ID: C5mVE2BwS...)  ← existing markets continue here
New:      PLP v2 (new Program ID)              ← new markets with blind voting
```

### 10.2 Why Not Migrate?

- Active v1 markets have plaintext positions — can't retroactively encrypt
- Different account structures (EncryptedPosition vs Position)
- Different instruction signatures (encrypted args)
- v1 markets must continue until they resolve + claims complete

### 10.3 Deployment Phases

```
Phase A: Devnet (Weeks 1-8)
  1. arcium init in plp_program
  2. Write circuits + modified instructions
  3. Deploy to Solana devnet
  4. Initialize MXE on devnet cluster (offset 456)
  5. Full integration testing

Phase B: Mainnet Soft Launch (Weeks 9-11)
  1. Coordinate MXE allocation with Arcium team
  2. Deploy PLP v2 to mainnet (new program ID)
  3. Frontend feature flag: creator can choose "Blind Voting" at market creation
  4. Monitor stability, costs, latency

Phase C: Full Rollout (Week 12+)
  1. Make blind voting the default for new markets
  2. v1 program enters maintenance mode (no new markets, existing continue)
  3. Eventually deprecate v1 when all markets resolve
```

### 10.4 Frontend Dual-Program Support

```typescript
// Market creation
if (blindVotingEnabled) {
  // Use PLP v2 program
  const program = new Program(IDL_V2, PLP_V2_PROGRAM_ID, provider);
  await program.methods.createMarket(...).rpc();
} else {
  // Use PLP v1 program (legacy)
  const program = new Program(IDL_V1, PLP_V1_PROGRAM_ID, provider);
  await program.methods.createMarket(...).rpc();
}

// Market display
const market = await fetchMarket(marketId);
if (market.programId === PLP_V2_PROGRAM_ID) {
  // Render BlindVoteCard (no prices, encrypted positions)
} else {
  // Render legacy MarketCard (current UI)
}
```

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Arcium Mainnet Alpha instability | Votes fail or delay | Medium | Retry logic; clear error states in UI; consider fallback mode |
| MPC latency > 10s per vote | Poor UX | Low-Medium | Optimistic UI with spinner; batch votes during high load |
| ARC token cost spikes | Voting becomes expensive | Medium | Platform absorbs ARC fees from 1.5% trade revenue |
| Circuit bug (wrong AMM math) | Incorrect share calculation | High impact | Extensive devnet testing; compare outputs against v1 AMM |
| Callback failure (tx dropped) | Position not stored | Medium | Retry mechanism; store computation_id for manual recovery |
| MXE cluster downtime | All voting blocked | Low | Queue votes; retry when cluster recovers; display maintenance banner |
| User can't decrypt position | Can't verify own vote | Low | Deterministic key from wallet signature — always recoverable |
| Information leakage via timing | Vote timing reveals patterns | Low | Batch votes in windows; add random delays |
| pool_balance delta leakage | Each vote shows SOL added (amount visible, direction not) | Inherent | Acceptable tradeoff — amount visible but direction+identity hidden |
| Pump.fun CPI in callback | Callback may be too complex | Medium | Split into two transactions (resolve + finalize) |

### 11.1 The pool_balance Leak

When a user votes, `pool_balance` increases publicly. An observer sees:

> "Pool went from 7.3 to 9.3 SOL — someone just put 2 SOL in"

They know the **amount** but NOT the **direction** (YES or NO) or **who**. This is an acceptable tradeoff because:

- The observer doesn't know if it was YES or NO
- They can't identify the wallet
- With multiple votes close together, individual amounts blur
- The total progress toward target is intentionally public

For maximum privacy, we could batch pool_balance updates (update every N minutes), but this adds complexity and delays the progress bar.

---

## 12. Timeline

```
PHASE 1: Foundation (Weeks 1-2)
├─ Week 1:
│   ├─ Install arcium CLI
│   ├─ arcium init in plp_program
│   ├─ Set up devnet MXE (cluster offset 456)
│   ├─ Write init_amm circuit (simple encryption of initial state)
│   └─ Test basic circuit compilation + deployment
│
├─ Week 2:
│   ├─ Write process_vote circuit (AMM + position + tally update)
│   ├─ Write resolve_tally circuit
│   ├─ Write calculate_claim circuit
│   └─ Unit test all circuits

PHASE 2: Smart Contract Integration (Weeks 3-5)
├─ Week 3:
│   ├─ New state structs (EncryptedAMMState, EncryptedPosition, EncryptedTally)
│   ├─ Modified create_market (initialize encrypted AMM)
│   └─ Modified buy_yes/buy_no (public layer + Arcium CPI)
│
├─ Week 4:
│   ├─ vote_callback instruction
│   ├─ Modified resolve_market (two-tx split: resolve + finalize)
│   ├─ resolve_callback instruction
│   └─ finalize_resolution instruction (Pump.fun CPI)
│
├─ Week 5:
│   ├─ Modified claim_rewards (Arcium CPI)
│   ├─ claim_callback instruction
│   ├─ init_comp_defs instruction
│   └─ Devnet end-to-end test: create → vote → resolve → finalize → claim

PHASE 3: Frontend (Weeks 6-8)
├─ Week 6:
│   ├─ @arcium-hq/client integration
│   ├─ Client-side encryption (X25519 key derivation, Rescue cipher)
│   ├─ Client-side position decryption
│   └─ New API routes for encrypted markets
│
├─ Week 7:
│   ├─ BlindVoteCard component (no prices, just progress + count)
│   ├─ EncryptedPositionBadge component
│   ├─ VotePendingSpinner (MPC processing indicator)
│   └─ ResolutionReveal animation
│
├─ Week 8:
│   ├─ Dual-program support (v1 legacy + v2 blind voting)
│   ├─ Market creation toggle (blind voting on/off)
│   ├─ Activity feed updates (hide direction/amount)
│   └─ Full frontend integration testing on devnet

PHASE 4: Hardening & Audit (Weeks 9-10)
├─ Week 9:
│   ├─ Error handling: MPC failures, callback retries, timeout states
│   ├─ Edge cases: expired markets during MPC, simultaneous votes
│   ├─ AMM math verification: compare v2 circuit output vs v1 plaintext
│   └─ Load testing: 50+ concurrent votes per market
│
├─ Week 10:
│   ├─ Security review: circuit correctness, key management
│   ├─ Stress test: maximum voters per market
│   ├─ Cost benchmarking: measure actual ARC token costs
│   └─ Documentation: developer guide, user guide

PHASE 5: Mainnet Launch (Weeks 11-12)
├─ Week 11:
│   ├─ Coordinate MXE allocation with Arcium team (Discord/email)
│   ├─ Deploy PLP v2 program to Solana mainnet
│   ├─ Initialize mainnet MXE + computation definitions
│   └─ Soft launch: blind voting as opt-in for market creators
│
├─ Week 12:
│   ├─ Monitor mainnet stability, latency, costs
│   ├─ Gather user feedback
│   ├─ Make blind voting default (if stable)
│   └─ v1 program enters maintenance mode
```

---

## 13. Open Questions for Arcium Team

Before starting implementation, we need answers to:

1. **Mainnet MXE access**: How do we get an MXE cluster on Mainnet Alpha? Application process or self-service?

2. **Persistent encrypted state across computations**: Can we pass `Enc<Mxe, AMMState>` from one `process_vote` call and update it in another? Does the MXE maintain state across separate computation invocations, or do we need to pass the encrypted state through callback accounts each time?

3. **Concurrent vote handling**: If two users vote simultaneously, both computations read the same encrypted AMM state. How do we handle this? Options:
   - Sequential processing (mempool ordering)
   - Optimistic locking (retry on state conflict)
   - Batch processing (accumulate votes)

4. **Cost per computation**: What are actual CU costs for a circuit with 2 divisions + 2 comparisons + 8 additions? Any benchmarks from similar DeFi circuits?

5. **Callback account limitations**: Can the callback instruction create new accounts (e.g., EncryptedPosition PDA), or must ALL accounts be pre-created in the queue instruction?

6. **Circuit output size**: Our `process_vote` returns 3 encrypted structs (position, AMM, tally). Does this fit in a single callback transaction?

7. **AMM initialization**: Can we encrypt initial state directly using the MXE public key (without a circuit), or must initialization also go through MPC?

8. **Latency p95**: What's the expected queue-to-callback latency on Mainnet Alpha? Critical for UX.

9. **Devnet stability**: Is the devnet cluster (offset 456) stable for development?

10. **C-SPL availability**: When will Confidential SPL Token transfers be available? This would make claim transfers fully private.

11. **Emergency recovery**: If our MXE cluster goes down mid-market, how do we recover the encrypted AMM state and tally?

12. **Maximum voters per market**: Given fixed-size arrays in Arcis, is there a practical limit on how many encrypted positions we can process in the batch claim circuit?

---

## Appendix A: Unchanged Instructions

These instructions require NO Arcium modification:

| Instruction | Reason |
|---|---|
| `init_treasury` | Admin-only, no user privacy needed |
| `set_admin` | Admin-only |
| `withdraw_fees` | Admin-only, fees are public |
| `extend_market` | Phase change is public (may need adaptation for encrypted AMM check) |
| `init_team_vesting` | Post-resolution, allocations are public |
| `claim_team_tokens` | Team claims are public (known founder) |
| `init_founder_vesting` | Post-resolution, allocations are public |
| `claim_founder_sol` | Founder claims are public |
| `claim_platform_tokens` | Platform claims are public |
| `close_position` | Cleanup (close EncryptedPosition PDA instead) |
| `close_market` | Cleanup, no sensitive data |
| `emergency_drain_vault` | Admin emergency |

**Note on `extend_market`**: Currently checks `total_yes_shares > total_no_shares` (YES winning). With encrypted tally, this check must move into an MPC circuit OR be rethought. Options:
- Remove the "YES must be winning" requirement for extension
- Add a small `check_yes_winning` circuit (1 comparison)
- Allow extension only if pool >= target (already checked on-chain)

---

## Appendix B: Circuit Complexity Estimates

| Circuit | Operations | Divisions | Comparisons | Additions | Est. Cost |
|---|---|---|---|---|---|
| `init_amm` | Encrypt initial state | 0 | 0 | 0 | Very Low |
| `process_vote` | Full AMM calculation | 2 | 2 | ~8 | Medium-High |
| `resolve_tally` | Compare totals | 0 | 3 | 0 | Low |
| `calculate_claim` | Proportional math | 1 | 2 | 2 | Medium |
| `check_yes_winning` (optional) | Compare totals | 0 | 1 | 0 | Very Low |

---

## Appendix C: Account Size Comparison

| Account | Current Size | Blind Voting Size | Delta |
|---|---|---|---|
| Market | 480 bytes | ~530 bytes (+voter_count, +enc refs) | +50 bytes |
| Position → EncryptedPosition | 136 bytes | ~220 bytes | +84 bytes |
| (new) EncryptedAMMState | N/A | ~170 bytes | +170 bytes per market |
| (new) EncryptedMarketTally | N/A | ~130 bytes | +130 bytes per market |
| Treasury | 41 bytes | 41 bytes | No change |
| TeamVesting | 166 bytes | 166 bytes | No change |
| FounderVesting | 134 bytes | 134 bytes | No change |

**Additional rent per market**: ~0.003 SOL (for EncryptedAMM + EncryptedTally PDAs)
**Additional rent per voter**: ~0.001 SOL (larger EncryptedPosition PDA)

---

## Appendix D: Glossary

| Term | Definition |
|---|---|
| **Blind Voting** | Users vote without seeing which side is winning |
| **MPC** | Multi-Party Computation — distribute computation across nodes so no single node sees data |
| **MXE** | Multi-Party eXecution Environment — Arcium's virtual machine for encrypted computation |
| **Arcis** | Arcium's Rust framework for writing MPC circuits |
| **Arx Node** | Individual computation node in the Arcium network |
| **Cerberus** | Arcium's dishonest-majority MPC protocol (secure if 1+ node honest) |
| **Rescue Cipher** | Symmetric encryption optimized for MPC (used for data encryption) |
| **X25519** | Elliptic curve Diffie-Hellman for key exchange (client ↔ MXE) |
| **CPI** | Cross-Program Invocation — Solana program calling another program |
| **PDA** | Program Derived Address — deterministic account address |
| **Callback** | Instruction invoked by Arcium after MPC completes |
| **Enc<Shared, T>** | Data encrypted for both client and MXE (user can decrypt) |
| **Enc<Mxe, T>** | Data encrypted for MXE only (persistent encrypted state) |
| **ARC** | Arcium's network token (used to pay computation fees) |
| **C-SPL** | Confidential SPL Token — encrypted token balances (future) |

---

*Last updated: February 2026*
*Status: DRAFT — Pending Arcium team consultation*
*Privacy model: Blind Voting (users see pool progress + voter count only)*
