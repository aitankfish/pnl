# Atomic Token Launch - Technical Documentation

## Overview

The PLP platform now implements **atomic token launch** to prevent front-running and ensure optimal token distribution. When a market resolves with YES winning, the token creation and market resolution happen in a **single atomic transaction**.

---

## Problem Solved: Front-Running Vulnerability

### Before (VULNERABLE):
```
Transaction 1: Create token on Pump.fun ✅
⏳ Gap here - anyone can buy tokens
Transaction 2: Market PDA buys tokens ❌ (worse price!)
```

**Issue**: Front-runners could buy tokens between transactions, causing:
- Market PDA pays higher price for tokens
- Less tokens distributed to YES voters
- Unfair advantage to front-runners

### After (SECURE):
```
Transaction 1 (ATOMIC):
  Instruction 1: Set compute budget (800k units)
  Instruction 2: Create token on Pump.fun
  Instruction 3: Resolve market + buy tokens (CPI to Pump.fun)
✅ All happens atomically - no gap for front-running!
```

---

## Technical Implementation

### Architecture

```
Frontend (useResolution.ts)
    ↓
1. Generate vanity mint (ends with "pnl")
    ↓
2. Upload metadata to Pump.fun IPFS
    ↓
3. Build Pump.fun createV2 instruction
    ↓
4. Get resolve_market instruction from API
    ↓
5. Combine into ATOMIC transaction:
   - Compute budget (800k)
   - createV2 (create token)
   - resolve_market (buy via CPI)
    ↓
6. Partial sign with mint keypair
    ↓
7. Send to wallet for final signature
    ↓
8. Confirm on-chain
```

### Key Code Locations

#### 1. Vanity Address Generator
**File**: `/src/lib/vanity.ts`

Generates token addresses ending with "pnl" for PNL platform branding.

```typescript
const mintKeypair = generateVanityKeypair({
  suffix: 'pnl',
  maxAttempts: 10_000_000,
});
// Result: ...abc123pnL (case-insensitive match)
```

**Performance**: ~10-60 seconds, 4k-5k attempts/second

#### 2. IPFS Metadata Upload
**File**: `/src/lib/hooks/useResolution.ts:352-386`

Uploads token metadata to Pump.fun's IPFS service before creation.

```typescript
const ipfsResponse = await fetch('https://pump.fun/api/ipfs', {
  method: 'POST',
  body: formData, // Contains name, symbol, description, image
});
const metadataUri = ipfsResult.metadataUri;
```

**Why needed**: Pump.fun requires IPFS metadata URI (not direct image URL) for tokens to appear on their website.

#### 3. Atomic Transaction Builder
**File**: `/src/lib/hooks/useResolution.ts:428-522`

Combines create + resolve instructions into single atomic transaction.

```typescript
// Extract resolve instruction from VersionedTransaction
const resolveVersionedTx = VersionedTransaction.deserialize(resolveTxBuffer);
const resolveInstruction = /* rebuild as TransactionInstruction */;

// Build atomic transaction
const atomicTx = new Transaction()
  .add(computeBudgetIx)      // 800k compute units
  .add(createInstruction)     // Pump.fun createV2
  .add(resolveInstruction);   // Market resolve + buy CPI

// Partial sign with mint keypair
atomicTx.partialSign(mintKeypair);

// Send to wallet for final signing
const signature = await signAndSendTransaction({
  transaction: atomicTx.serialize({ requireAllSignatures: false }),
  wallet: solanaWallet,
  chain: 'solana:mainnet',
});
```

#### 4. On-Chain Program
**File**: `/plp_program/programs/errors/src/instructions/resolve_market.rs:206-227`

Performs CPI to Pump.fun buy instruction after market resolution.

```rust
pump::cpi::buy(
    CpiContext::new_with_signer(
        ctx.accounts.pump_program.to_account_info(),
        pump::cpi::accounts::Buy {
            global: ctx.accounts.pump_global.to_account_info(),
            bonding_curve: ctx.accounts.bonding_curve.to_account_info(),
            user: market.to_account_info(), // Market PDA is buyer
            // ... other accounts
        },
        signer_seeds, // Market PDA signs
    ),
    market.pool_balance,  // Amount of SOL to spend
    market.pool_balance,  // Max SOL cost
)?;
```

---

## Transaction Flow Details

### Instruction 1: Compute Budget
```
ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 })
```

**Why 800k?**
- createV2: ~300k units
- resolve_market: ~200k units
- buy CPI: ~200k units
- Buffer: ~100k units
- Total: ~800k units (safe margin)

### Instruction 2: Pump.fun createV2
```typescript
pumpSdk.createV2Instruction({
  mint: mintKeypair.publicKey,
  name: "Token Name",
  symbol: "SYMBOL",
  uri: "https://ipfs.io/ipfs/Qm...", // IPFS metadata
  creator: walletPublicKey,
  user: walletPublicKey,
  mayhemMode: false, // Standard bonding curve
});
```

**What it does**:
- Creates Token2022 mint account
- Initializes Pump.fun bonding curve
- Sets up metadata with IPFS URI
- Makes token tradeable on Pump.fun

### Instruction 3: resolve_market
```typescript
resolveInstruction({
  market: marketPDA,
  treasury: treasuryPDA,
  tokenMint: mintKeypair.publicKey,
  marketTokenAccount: ATA,
  // ... 15+ Pump.fun accounts for buy CPI
  pumpGlobal,
  bondingCurve,
  bondingCurveTokenAccount,
  eventAuthority,
  pumpProgram,
  systemProgram,
  tokenProgram,
  // ...
});
```

**What it does**:
1. Checks market end time
2. Deducts 5% completion fee to treasury
3. Uses remaining 95% to buy tokens via Pump.fun CPI
4. Receives tokens to market PDA
5. Updates market state to "Resolved"

---

## Signing Process

### Two Signers Required

1. **Mint Keypair** (generated in frontend)
   - Signs the createV2 instruction
   - Authorizes token creation
   - Partial signature added via `atomicTx.partialSign(mintKeypair)`

2. **User Wallet** (Privy wallet)
   - Signs the entire transaction
   - Pays transaction fees
   - Authorizes resolve_market instruction
   - Signs via Privy SDK: `signAndSendTransaction()`

### Why Partial Signing?

```typescript
// After building transaction
atomicTx.partialSign(mintKeypair); // Sign with mint keypair first

// Serialize without verifying all signatures yet
const serialized = atomicTx.serialize({
  requireAllSignatures: false,
  verifySignatures: false,
});

// Wallet adds final signature and sends
await signAndSendTransaction({
  transaction: serialized,
  wallet: solanaWallet,
});
```

This allows the transaction to be signed by multiple keypairs across different contexts (frontend-generated keypair + wallet).

---

## Network-Specific Behavior

### Mainnet (Production)
✅ **Full Pump.fun Integration**

1. Generate vanity address (ends with "pnl") - 10-60s
2. Upload metadata to Pump.fun IPFS - 2-5s
3. Create token with Token2022 + bonding curve - atomic
4. Market PDA buys tokens at launch price - atomic
5. Token appears on Pump.fun website immediately
6. Auto-migrates to Raydium at ~$69k market cap

**Total time**: ~30-120 seconds

### Devnet (Testing)
⚠️ **Simple SPL Token Only**

1. Generate random keypair (no vanity) - instant
2. Skip IPFS upload (not needed)
3. Create simple SPL token - single transaction
4. No Pump.fun (not available on devnet)
5. No bonding curve
6. No Raydium migration

**Purpose**: Test UI, distribution logic, and database updates only

---

## Testing Checklist

### Prerequisites
- [ ] Wallet has >0.05 SOL on mainnet
- [ ] Test market created and funded (0.1 SOL minimum)
- [ ] Market has YES votes
- [ ] Funding phase ended
- [ ] End time passed
- [ ] Token metadata prepared (name, symbol, description, image)

### Step-by-Step Test

1. **Create Test Market**
   ```
   - Name: "Test Market for Token Launch"
   - Token Symbol: "TEST"
   - Pool Size: 0.1 SOL (minimum)
   - End Date: Today + 1 hour
   ```

2. **Fund Market**
   ```
   - Place bet on YES with 0.01 SOL
   - Wait for funding phase to end
   - Wait for end time to pass
   ```

3. **Launch Token**
   ```
   - Click "Launch Token Now" button
   - Wait for vanity generation (10-60s)
   - Approve transaction in wallet
   - Wait for confirmation (30-60s)
   ```

4. **Verify Results**
   ```
   - [ ] Token address ends with "pnl" (case-insensitive)
   - [ ] Transaction confirmed on Solscan
   - [ ] Token appears on Pump.fun: https://pump.fun/{mint}
   - [ ] Market status updated to "Resolved"
   - [ ] Market PDA has tokens in ATA
   - [ ] Tokens distributable to YES voters
   ```

### Expected Console Output

```
═══════════════════════════════════════════════════
🚀 TOKEN LAUNCH FLOW STARTED
═══════════════════════════════════════════════════

✅ MAINNET MODE - FULL PUMP.FUN INTEGRATION

🎯 Generating vanity token address (ending with "pnl")...
🔍 Generating vanity address ending with "pnl"...
   This brands the token as launched from PNL platform
   Estimated time: 10-60 seconds

✅ Vanity address found!
   Address: 3FmHoaSkyKtZL8wvCN5MowwsCiJcErjLipuq8mePSpnL
   Attempts: 57,676
   Time: 11.94s
   Rate: 4,831 addresses/second

✅ Vanity token mint: 3FmHoaSkyKtZL8wvCN5MowwsCiJcErjLipuq8mePSpnL
   ↳ Branded with PNL platform signature!

📤 Uploading metadata to Pump.fun IPFS...
✅ Metadata uploaded to IPFS
   URI: https://ipfs.io/ipfs/QmYeHK1SC9ghnFEQeWY2rNNW7cbA58FaVAtEPE9BFwBhyU

🔧 Building Pump.fun createV2 instruction...
✅ Pump.fun createV2 instruction built (Token2022 format)

🔧 Preparing resolve_market instruction...
✅ Resolve instruction prepared

⚡ Building atomic transaction (create + resolve)...
   This prevents front-running and ensures best token price
✅ Atomic transaction built with 3 instructions:
   1. Compute budget (800k units)
   2. Pump.fun createV2 (Token2022)
   3. Market resolve (with buy CPI)

✅ Partially signed with mint keypair
Using embedded Solana wallet for atomic transaction
📤 Signing and sending ATOMIC transaction...
   This creates token AND resolves market in ONE transaction
   No gap for front-running!

✅ Atomic transaction sent: 2ZqJ...abc123
   View on explorer: https://solscan.io/tx/2ZqJ...abc123
⏳ Confirming atomic transaction...
✅ Atomic transaction confirmed!
   • Token created on Pump.fun ✅
   • Market resolved ✅
   • Tokens bought with pooled SOL ✅

📝 Updating market state in database...

═══════════════════════════════════════════════════
🎉 MAINNET ATOMIC TOKEN LAUNCH SUCCESSFUL!
═══════════════════════════════════════════════════
Token Mint: 3FmHoaSkyKtZL8wvCN5MowwsCiJcErjLipuq8mePSpnL
   ↳ Ends with "pnl" (PNL platform branded)
Signature: 2ZqJ...abc123

🔗 LINKS:
  • Pump.fun: https://pump.fun/3FmHoaSkyKtZL8wvCN5MowwsCiJcErjLipuq8mePSpnL
  • Solscan Token: https://solscan.io/token/3FmHoaSkyKtZL8wvCN5MowwsCiJcErjLipuq8mePSpnL
  • Transaction: https://solscan.io/tx/2ZqJ...abc123

✨ TOKEN DISTRIBUTION:
  • 79% to YES voters (claimable)
  • 20% to team (vested: 5% now, 15% locked)
  • 1% to platform

⚡ BONDING CURVE ACTIVE:
  • Token live on Pump.fun with proper metadata
  • Market PDA bought tokens at optimal price (no front-running)
  • Will migrate to Raydium at ~$69k market cap
═══════════════════════════════════════════════════
```

---

## Error Handling

### Common Errors

#### 1. Vanity Generation Timeout
```
❌ Max attempts reached without finding match
   Tried 10,000,000 addresses
```

**Solution**: Increase `maxAttempts` or use fallback to random keypair after timeout.

#### 2. IPFS Upload Failed
```
❌ IPFS upload failed: 500 Internal Server Error
```

**Solution**:
- Check image URL is valid and accessible
- Retry with exponential backoff
- Verify Pump.fun API is operational

#### 3. Compute Budget Exceeded
```
❌ Transaction failed: exceeded CUs meter at BPF instruction
```

**Solution**: Increase compute budget from 800k to 1M:
```typescript
const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
  units: 1_000_000,
});
```

#### 4. Insufficient SOL Balance
```
❌ Insufficient funds for transaction
```

**Solution**: Ensure wallet has >0.05 SOL for transaction fees + token creation.

#### 5. Market End Time Not Reached
```
❌ Program error: MarketNotEnded
```

**Solution**: Wait for market end time to pass before launching token.

---

## Cost Breakdown

### Mainnet Token Launch

| Item | Cost | Notes |
|------|------|-------|
| Vanity generation | FREE | CPU time only (~10-60s) |
| IPFS metadata upload | FREE | Pump.fun provides free IPFS |
| Token creation (createV2) | ~0.02 SOL | Pump.fun fee (~$5) |
| Transaction fees | ~0.0005 SOL | Network fees (~$0.12) |
| Rent exemption | ~0.001 SOL | Token accounts (~$0.25) |
| **Total** | **~0.022 SOL** | **~$5.50** |

**No additional cost for vanity addresses or atomic transactions!**

---

## Security Considerations

### ✅ Atomic Execution
- Create and buy happen in same transaction
- No gap for front-running
- Market PDA gets optimal price

### ✅ Vanity Branding
- All PNL tokens end with "pnl"
- Easy to identify legitimate PNL launches
- Harder for scammers to impersonate

### ✅ IPFS Metadata
- Immutable metadata storage
- Verifiable on-chain
- Resistant to tampering

### ⚠️ Considerations
- Mint keypair only exists in memory during creation
- Ensure secure wallet connection for signing
- Monitor compute budget usage for complex transactions
- Test thoroughly on devnet before mainnet launch

---

## Monitoring & Analytics

### Key Metrics to Track

1. **Vanity Generation Performance**
   - Average attempts: ~50k-200k
   - Average time: ~10-60 seconds
   - Rate: ~4k-5k addresses/second

2. **Transaction Success Rate**
   - Target: >95% success rate
   - Monitor failed transactions
   - Track retry patterns

3. **Compute Usage**
   - Current limit: 800k units
   - Monitor actual usage
   - Adjust if needed

4. **Token Visibility**
   - Verify tokens appear on Pump.fun
   - Check metadata displays correctly
   - Confirm trading works

---

## Upgrade Path

### Future Improvements

1. **Vanity Generation Optimization**
   - Web Workers for parallel generation
   - GPU acceleration (WebGPU)
   - Pre-generated vanity pool

2. **Error Recovery**
   - Automatic retry logic
   - Fallback to non-vanity address
   - Transaction simulation before sending

3. **User Experience**
   - Progress bar for vanity generation
   - Estimated time remaining
   - Ability to cancel and retry

4. **Analytics Dashboard**
   - Real-time token launch metrics
   - Success/failure tracking
   - Performance monitoring

---

## References

- **Pump.fun SDK**: `@pump-fun/pump-sdk`
- **Test Script**: `/test-pumpfun-launch.ts`
- **Vanity Generator**: `/src/lib/vanity.ts`
- **Resolution Hook**: `/src/lib/hooks/useResolution.ts`
- **On-Chain Program**: `/plp_program/programs/errors/src/instructions/resolve_market.rs`
- **Improvements Doc**: `/TOKEN_LAUNCH_IMPROVEMENTS.md`

---

**Last Updated**: 2025-01-18
**Version**: 3.0 (Atomic Transaction Implementation)
**Status**: ✅ Ready for Mainnet Testing
