# Market Resolution Error - Troubleshooting Guide

**Date:** December 11, 2024
**Status:** ⚠️ UNRESOLVED - Account migration complete, vault ownership issue remains
**Market:** `2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX`
**Program:** `C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86`

---

## Current Error

```
AnchorError caused by account: market_vault
Error Code: AccountNotSystemOwned
Error Number: 3011
Error Message: The given account is not owned by the system program
```

**This error occurs when trying to resolve the market from the live website.**

---

## What We've Accomplished

### ✅ 1. Program Deployment & Optimization
- **Reduced program size:** 551KB → 515KB (36KB savings)
- **Method:** Commented out 60+ debug `msg!()` calls across 6 files
- **Deployment:** Successfully deployed to mainnet multiple times
- **Latest deployment:** Transaction `5CZ6CDqaekZZouSEqS7Ssa3AePcFKqwDBi42ZbdBi1mX92uh8DbPwdcU5qj2rxWn9sQTFhqSxqxTpgMFQ4wY4r4C`

### ✅ 2. Market Account Migration (COMPLETED)
- **Problem:** Market account was 466 bytes (old struct), program expected 480 bytes (new struct with founder vesting fields)
- **Solution:** Created `migrate_market_v2` instruction that:
  1. Deserializes account using old `MarketV1` struct
  2. Adds new vesting fields (`founder_excess_sol_allocated`, `founder_vesting_initialized`)
  3. Re-serializes using new `Market` struct with proper Borsh layout

**Migration Transaction:** `4Up8NTWiyzHqWyDPW7bopFGSU4whijsF2uB622LzadPs32wAnwmfMFEHQpHxHfmqB6CzegDPV5DzhEyE9mgbHeJ1`

**Verification:**
- Account size: 480 bytes ✅
- Treasury PDA found at correct offset (byte 266) ✅
- Bump value: 255 ✅
- Vesting fields initialized to 0/false ✅

---

## Current Issue: AccountNotSystemOwned

### Error Details

The `market_vault` account is expected to be owned by the **System Program** (`11111111111111111111111111111111`).

**INVESTIGATION RESULT:** ✅ The vault IS owned by the system program!
- Vault PDA: `4wnj5i4scVsGLYL7BGYBB3RmwmeDhPsJndhMg1VPEytz`
- Owner: `11111111111111111111111111111111` (System Program) ✅
- Balance: 0.08089088 SOL
- Data Length: 0 bytes

**This means the error is likely coming from:**
1. **Frontend passing wrong account** - Check if the frontend is deriving the vault PDA correctly
2. **Anchor constraint issue** - The `SystemAccount` type might have additional checks beyond ownership
3. **Account order issue** - Accounts might be passed in wrong order to the instruction

### Market Vault PDA Details

**Derivation:**
```rust
seeds = [b"market_vault", market.key().as_ref()]
```

**Expected Market Vault Address:**
```
Derived from market: 2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX
```

### Resolution Instruction Requirements

From `resolve_market.rs:29-35`:
```rust
/// Market Vault PDA (holds all SOL, used as buyer in Pump.fun CPI)
#[account(
    mut,
    seeds = [b"market_vault", market.key().as_ref()],
    bump
)]
pub market_vault: SystemAccount<'info>,
```

**Key Point:** The instruction expects `market_vault` to be a `SystemAccount`, which means it MUST be owned by the System Program.

---

## Investigation Steps

### 1. Check Market Vault Owner

```bash
# Calculate market vault PDA
cat > scripts/check-vault-owner.ts << 'EOF'
import { Connection, PublicKey } from '@solana/web3.js';

const MARKET_ADDRESS = '2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX';
const PROGRAM_ID = 'C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function main() {
  const connection = new Connection(RPC_URL);
  const marketPubkey = new PublicKey(MARKET_ADDRESS);
  const programId = new PublicKey(PROGRAM_ID);

  // Derive market vault PDA
  const [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('market_vault'), marketPubkey.toBytes()],
    programId
  );

  console.log('Market Vault PDA:', vaultPDA.toBase58());
  console.log('Vault Bump:', vaultBump);

  // Check account info
  const vaultInfo = await connection.getAccountInfo(vaultPDA);

  if (!vaultInfo) {
    console.log('\n❌ Vault account does NOT exist!');
    return;
  }

  console.log('\n=== Vault Account Info ===');
  console.log('Owner:', vaultInfo.owner.toBase58());
  console.log('Balance:', vaultInfo.lamports / 1e9, 'SOL');
  console.log('Data Length:', vaultInfo.data.length, 'bytes');
  console.log('Executable:', vaultInfo.executable);
  console.log('Rent Epoch:', vaultInfo.rentEpoch);

  // Check if owned by system program
  const SYSTEM_PROGRAM = '11111111111111111111111111111111';
  const isSystemOwned = vaultInfo.owner.toBase58() === SYSTEM_PROGRAM;

  console.log('\n=== Ownership Check ===');
  console.log('Expected owner: System Program (11111111111111111111111111111111)');
  console.log('Actual owner:', vaultInfo.owner.toBase58());
  console.log('Is System Owned:', isSystemOwned ? '✅' : '❌');

  if (!isSystemOwned) {
    console.log('\n⚠️  ISSUE FOUND:');
    console.log('The vault is owned by:', vaultInfo.owner.toBase58());
    console.log('This is likely the PLP program itself.');
    console.log('The vault needs to be a System Account to pass the resolve_market check.');
  }
}

main().catch(console.error);
EOF

npx tsx scripts/check-vault-owner.ts
```

### 2. Check How Vault Was Created

Search for vault initialization in the codebase:

```bash
# Find where market_vault is created
grep -r "market_vault" plp_program/programs/errors/src/instructions/ --include="*.rs" -A 5
```

Look for:
- Is it created as a `SystemAccount`?
- Is it created as a PDA owned by the program?
- When was it initialized (create_market? buy_yes/buy_no?)?

### 3. Review Market Creation History

Check the on-chain transaction history for this market to see how the vault was initialized:

```bash
# Get market creation transaction
solana transaction-history 2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX --url mainnet-beta
```

---

## Possible Solutions

### Option 1: Change Vault Account Type in Program

**If the vault was created as a program-owned PDA:**

Update `resolve_market.rs` to accept a program-owned account instead of `SystemAccount`:

```rust
/// Market Vault PDA (holds all SOL, used as buyer in Pump.fun CPI)
#[account(
    mut,
    seeds = [b"market_vault", market.key().as_ref()],
    bump
)]
pub market_vault: AccountInfo<'info>,  // Changed from SystemAccount
```

**Pros:**
- Simple code change
- No migration needed

**Cons:**
- Need to rebuild and redeploy program
- Costs ~3.5 SOL for deployment
- May affect other instructions that use market_vault

### Option 2: Migrate Vault Ownership

**If we can transfer ownership:**

Create a migration instruction that:
1. Transfers all SOL from program-owned vault to a new system-owned account
2. Updates market state to point to new vault (if vault address is stored)

**Challenges:**
- Need to ensure all SOL is preserved
- Need to handle rent-exemption
- Complex migration logic

### Option 3: Use Emergency Drain + Manual Resolution

**Workaround for this specific market:**

1. Use `emergency_drain_vault` to extract SOL to founder
2. Manually distribute funds to voters off-chain
3. Close market account

**Pros:**
- Recovers the 0.08 SOL stuck in vault
- No program changes needed

**Cons:**
- Manual process
- Doesn't fix the root issue
- Not scalable for multiple markets

---

## Files Modified During This Session

### Program Files (Rust)

1. **`plp_program/programs/errors/src/instructions/migrate_market_v2.rs`** ✅ COMPLETED
   - Created full migration instruction
   - Deserializes old MarketV1, re-serializes as new Market
   - Handles both 466-byte and 480-byte accounts

2. **`plp_program/programs/errors/src/instructions/mod.rs`**
   - Added migration module export

3. **`plp_program/programs/errors/src/lib.rs`**
   - Added `migrate_market_v2` instruction endpoint

4. **Debug Log Removals** (program size optimization)
   - `resolve_market.rs` - 10 msg! calls commented
   - `pump_cpi.rs` - 16 msg! calls commented
   - `close_market.rs` - 11 msg! calls commented
   - `extend_market.rs` - 9 msg! calls commented
   - `claim_team_tokens.rs` - 7 msg! calls commented
   - `claim_founder_sol.rs` - 7 msg! calls commented

### Migration Scripts (TypeScript)

1. **`scripts/migrate-raw.ts`** ✅ WORKING
   - Raw transaction migration script
   - Successfully migrated market account

2. **`scripts/migrate-market-quick.ts`**
   - Anchor-based migration (not used - would need updated IDL)

3. **`scripts/inspect-market-data.ts`**
   - Debugging script to inspect account byte layout

4. **`scripts/decode-market-struct.ts`**
   - Manual struct decoding for debugging

5. **`scripts/find-treasury-in-account.ts`**
   - Searches for treasury PDA bytes in account data

---

## Next Steps (TODO)

### Immediate Investigation

1. ✅ **Check vault ownership** - COMPLETED
   - Vault IS system-owned ✅
   - Vault PDA: `4wnj5i4scVsGLYL7BGYBB3RmwmeDhPsJndhMg1VPEytz`
   - Balance: 0.08089088 SOL

2. **🔍 CHECK FRONTEND VAULT DERIVATION** (MOST LIKELY ISSUE)
   - Search for `resolveMarket` function in frontend code
   - Check how `market_vault` PDA is derived
   - Compare with correct derivation:
     ```typescript
     const [vaultPDA] = PublicKey.findProgramAddressSync(
       [Buffer.from('market_vault'), marketPubkey.toBytes()],
       programId
     );
     ```
   - Expected vault: `4wnj5i4scVsGLYL7BGYBB3RmwmeDhPsJndhMg1VPEytz`

3. **Check account order in frontend**
   - Verify the order of accounts passed to `resolveMarket`
   - Must match the order in `resolve_market.rs`:
     1. market
     2. market_vault
     3. treasury
     4. token_mint
     5. market_token_account
     6. (etc...)

4. **Review vault initialization**
   - Search `create_market.rs` for vault creation
   - Check `buy_yes.rs` and `buy_no.rs` for first SOL transfer logic

5. **Check other markets**
   - Do other markets have the same issue?
   - Or is this specific to old markets created before a program change?

### Decision Point

Based on vault owner investigation, choose:

- **If vault is program-owned:** Modify program to accept `AccountInfo` instead of `SystemAccount`
- **If vault should be system-owned:** Investigate why it's not and create fix/migration
- **For immediate recovery:** Use emergency drain + manual distribution

### Program Changes (if needed)

1. Update `resolve_market.rs` account constraints
2. Review all instructions that use `market_vault`
3. Update tests to match new account type
4. Rebuild, test on devnet, deploy to mainnet

---

## Technical Context

### Market Account Structure

**Old (466 bytes total = 8 discriminator + 458 data):**
- No founder vesting fields
- Treasury at data offset ~249 (absolute byte 257)

**New (480 bytes total = 8 discriminator + 472 data):**
- Includes `founder_excess_sol_allocated: u64` (8 bytes)
- Includes `founder_vesting_initialized: bool` (1 byte)
- Treasury at data offset ~258 (absolute byte 266)

### Why Byte Offsets Were Wrong Initially

Borsh serialization uses **actual string lengths**, not maximum lengths:
- `ipfs_cid: String` - Stored as `4 bytes (length) + actual_chars`
- `metadata_uri: String` - Stored as `4 bytes (length) + actual_chars`

Our initial manual byte manipulation assumed maximum sizes (64 for ipfs_cid, 200 for metadata_uri), but the actual account used variable lengths (59 for this market's IPFS CID).

**Solution:** Proper deserialization/re-serialization handles variable lengths automatically.

---

## Deployment History

| Timestamp | Transaction | Size | Description |
|-----------|-------------|------|-------------|
| Dec 11 02:43 | `3kx4mD7Jd14PQYRyWrz4SLYrVLKsWFNkbEmaKRqjXHskhrVc9LZbMbvHyEMC5WcoBpCCuRnxyyMVEj76S9pgpZyo` | 510KB | First migration attempt (wrong approach) |
| Dec 11 02:46 | `21FgH2ofQTt34V9UngkQcdhjXkorRRqQZc7yn99fVFP9JH3CF9suitQwPXf1ujwsyUxMxkwPGbRuxTDBiSYNpQPF` | 511KB | Second attempt with byte layout fix |
| Dec 11 03:00 | `5CZ6CDqaekZZouSEqS7Ssa3AePcFKqwDBi42ZbdBi1mX92uh8DbPwdcU5qj2rxWn9sQTFhqSxqxTpgMFQ4wY4r4C` | 515KB | Final version with proper deserialization migration |

## Migration Transaction History

| Timestamp | Transaction | Result |
|-----------|-------------|---------|
| Dec 11 02:47 | `4WF77W6xuWMaD2LP3kvLaZ9zuxLkCRUBCGkWSJQ7CNpVXU1CQTovjog7pZFxZZCfCp8dpNdHV721tmnEbDayyDim` | Account expanded to 480 bytes (wrong layout) |
| Dec 11 02:49 | `2tPg8MN5sg21rJWkwTgGmAJEa9jYMQM6jC7c1oqr1CYeTeCj1M5Emj8s2DAmybFVUCBsfvKZJaZFdzUT37ovL45g` | Attempted byte shuffling (wrong offsets) |
| Dec 11 03:02 | `4Up8NTWiyzHqWyDPW7bopFGSU4whijsF2uB622LzadPs32wAnwmfMFEHQpHxHfmqB6CzegDPV5DzhEyE9mgbHeJ1` | ✅ SUCCESS - Proper migration with deserialization |

---

## References

- **Market Address:** `2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX`
- **Program ID:** `C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86`
- **Treasury PDA:** `H1QAk6FMogmedCFY5YH5PK214fFDkFQuLPaE96RGQxFs` (bump: 255)
- **Market Vault PDA:** `4wnj5i4scVsGLYL7BGYBB3RmwmeDhPsJndhMg1VPEytz` (bump: 255)
  - Owner: System Program ✅
  - Balance: 0.08089088 SOL
  - Derivation: `PublicKey.findProgramAddressSync([Buffer.from('market_vault'), marketPubkey.toBytes()], programId)`

---

## Contact/Notes

**Developer:** Bishwanath Bastola
**Session Date:** December 11, 2024
**Context:** This issue arose after upgrading the program with founder vesting features but before migrating existing markets.

**Key Lesson:** When adding fields to on-chain structs in the middle (not at the end), you MUST use proper deserialization/re-serialization rather than manual byte manipulation, because Borsh uses variable-length encoding for strings and other dynamic types.
