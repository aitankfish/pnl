# Bags Integration Findings

## Overview

Bags (bags.fm) is a Solana token launch platform built on **Meteora Dynamic Bonding Curve (DBC)**. It provides an alternative to Pump.fun with more flexible fee sharing and customizable bonding curves.

This document outlines the integration requirements for adding Bags as an alternative launch platform alongside the existing Pump.fun integration.

---

## Platform Comparison

| Feature | Pump.fun (Current) | Bags (Meteora DBC) |
|---------|-------------------|-------------------|
| **SDK** | `@pump-fun/pump-sdk` v1.21.0 | `@bagsfm/bags-sdk` or `@meteora-ag/dynamic-bonding-curve-sdk` |
| **Program ID** | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` (DBC) |
| **Token Standard** | Token2022 (6 decimals) | SPL + Token2022 |
| **Bonding Curve** | Constant Product AMM | Customizable (market cap based) |
| **Migration Target** | Raydium (~$69k MC) | Meteora DAMM v1/v2 |
| **Creator Fees** | Single vault PDA | Multiple claimers (up to 15+ with LUT) |
| **Devnet Support** | Limited (simple SPL) | Full support |
| **API Key Required** | No | Yes (from dev.bags.fm) |

---

## Bags Program IDs (Mainnet-beta)

| Program | Purpose | Program ID |
|---------|---------|-----------|
| **Meteora DBC** | Token creation & bonding curves | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` |
| **Bags Fee Share V1** | Legacy fee splits (deprecated) | `FEEhPbKVKnco9EXnaY3i4R5rQVUx91wgVfu8qokixywi` |
| **Bags Fee Share V2** | Current fee config & claiming | `7ko7duEv4Gk5kRoJKGTRVgypuRHvTbCFbDeaC9Q4pWk3` |
| **Meteora DAMM v2** | AMM after graduation | `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG` |
| **Bags Authority** | Creator/authority address | `BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv` |
| **Address Lookup Table** | Transaction size optimization | `Eq1EVs15EAWww1YtPTtWPzJRLPJoS6VYP9oW9SbNr3yp` |

---

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                        PUMP.FUN FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Create token (Pump.fun program)                              │
│  2. Bonding curve trading (constant product AMM)                 │
│  3. Auto-migrate to Raydium at ~$69k market cap                  │
│  4. Creator fees → single creatorVaultPda                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    BAGS (METEORA DBC) FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Create DBC pool (Meteora DBC program)                        │
│  2. Configure fee share (Bags Fee Share V2)                      │
│  3. Bonding curve trading (customizable curve)                   │
│  4. Migrate to Meteora DAMM v1/v2 at configured threshold        │
│  5. Creator fees → multiple claimers with BPS allocation         │
│  6. LP tokens lockable with ongoing fee claiming                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## SDK Installation

```bash
# Option 1: Bags SDK (recommended - higher level abstraction)
npm install @bagsfm/bags-sdk @solana/web3.js bs58

# Option 2: Direct Meteora SDK (lower level, more control)
npm install @meteora-ag/dynamic-bonding-curve-sdk @solana/web3.js
```

---

## Bags SDK Usage

### Initialization

```typescript
import { BagsSDK } from '@bagsfm/bags-sdk';
import { Connection } from '@solana/web3.js';

const connection = new Connection(process.env.SOLANA_RPC_URL);
const sdk = new BagsSDK(process.env.BAGS_API_KEY, connection, 'processed');
```

### Token Launch Flow

```typescript
// Step 1: Create token info and metadata
const { mint, metadata } = await sdk.tokenLaunch.createTokenInfoAndMetadata({
  imageUrl: 'https://example.com/token-image.png',
  name: 'My Token',
  symbol: 'MTK',
  description: 'Token description',
  twitterUrl: 'https://twitter.com/mytoken',
  websiteUrl: 'https://mytoken.com',
  telegramUrl: 'https://t.me/mytoken',
});

// Step 2: Configure fee sharing (total must equal 10000 BPS = 100%)
const feeConfig = await sdk.tokenLaunch.createBagsFeeShareConfig({
  feeClaimers: [
    { wallet: creatorWallet, bps: 8000 },  // 80% to creator
    { wallet: partnerWallet, bps: 2000 },  // 20% to partner
  ],
});

// Step 3: Create launch transaction
const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
  mint,
  payer: walletPublicKey,
  initialBuyAmountLamports: 100_000_000, // 0.1 SOL initial buy
  feeConfig,
});

// Step 4: Sign and send transaction
const signedTx = await wallet.signTransaction(launchTx);
const signature = await connection.sendRawTransaction(signedTx.serialize());
```

### Fee Claiming

```typescript
// Get token creators for a mint
const creators = await sdk.state.getTokenCreators(tokenMint);

// Claim fees (handled by Bags Fee Share V2 program)
const claimTx = await sdk.fee.claimFees({
  wallet: walletPublicKey,
  tokenMint,
});
```

---

## Meteora DBC SDK Usage (Alternative)

```typescript
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

// Initialize client
const client = new DynamicBondingCurveClient(connection, wallet);

// Build curve configuration
const curveConfig = client.buildCurveWithMarketCap({
  initialMarketCap: 10_000,      // $10k starting MC
  migrationMarketCap: 100_000,  // $100k migration threshold
  totalSupply: 1_000_000_000,   // 1B tokens
  decimals: 6,
});

// Create pool
const { transaction, mint } = await client.createPool({
  config: curveConfig,
  name: 'My Token',
  symbol: 'MTK',
  uri: metadataUri,
  payer: walletPublicKey,
  poolCreator: walletPublicKey,
});

// Swap (buy/sell)
const swapQuote = await client.swapQuote({
  pool: poolAddress,
  amountIn: 100_000_000, // 0.1 SOL
  swapDirection: 'buy',
});

const swapTx = await client.swap({
  pool: poolAddress,
  amount: 100_000_000,
  minOutput: swapQuote.minOutput,
  owner: walletPublicKey,
});
```

---

## Implementation Plan for PNL Platform

### Phase 1: Database Schema Updates

```typescript
// Update Project model (src/lib/database/models.ts)
interface Project {
  // ... existing fields
  launchPlatform: 'pumpfun' | 'bags';  // NEW: Platform selection
  bagsConfig?: {                        // NEW: Bags-specific config
    initialMarketCap?: number;
    migrationMarketCap?: number;
    feeClaimers?: Array<{
      wallet: string;
      bps: number;
      platform?: 'twitter' | 'kick' | 'github';
    }>;
  };
}

// Update PredictionMarket model
interface PredictionMarket {
  // ... existing fields
  launchPlatform: 'pumpfun' | 'bags';   // NEW: Track platform
  bagsPoolAddress?: string;              // NEW: DBC pool address
  meteoraDammPool?: string;              // NEW: After migration
}
```

### Phase 2: New Files to Create

```
src/lib/bags.ts                              # Bags SDK utilities & PDA derivation
src/lib/hooks/useBagsResolution.ts           # Bags-specific resolution hook
src/app/api/markets/resolve/bags/prepare/route.ts    # Prepare Bags launch
src/app/api/markets/resolve/bags/complete/route.ts   # Complete Bags launch
src/app/api/user/[wallet]/bags-fees/route.ts         # Bags fee claiming
```

### Phase 3: Update Existing Files

| File | Changes |
|------|---------|
| `src/app/create/page.tsx` | Add platform selector dropdown |
| `src/lib/hooks/useResolution.ts` | Branch logic for Pump vs Bags |
| `src/lib/hooks/useCreatorFees.ts` | Add Bags fee claiming support |
| `src/app/api/projects/create/route.ts` | Handle launchPlatform field |
| `src/components/MarketCard.tsx` | Show platform badge |
| `src/app/launched/page.tsx` | Filter by platform |

### Phase 4: Smart Contract Considerations

**Option A: Client-Side Only (Recommended for MVP)**
- No smart contract changes needed
- Bags token launch handled entirely client-side
- Resolution instruction just records the token address

**Option B: CPI Integration (Future Enhancement)**
- Add Meteora DBC CPI to Anchor program
- More complex, requires program upgrade
- Better atomicity guarantees

---

## Environment Variables Required

```bash
# .env additions
BAGS_API_KEY=your_bags_api_key          # Get from dev.bags.fm
NEXT_PUBLIC_BAGS_ENABLED=true           # Feature flag
```

---

## Key Differences in Token Launch Flow

### Current Pump.fun Flow (useResolution.ts)

```
1. Generate vanity keypair (suffix "pnl")
2. Upload metadata to Pump.fun IPFS
3. Build atomic transaction:
   - ComputeBudgetProgram.setComputeUnitLimit
   - Pump.fun createV2Instruction
   - CreateAssociatedTokenAccount
   - resolve_market instruction (with buy CPI)
4. Partial sign with mint keypair
5. Sign + send with user wallet
6. Update database
```

### Proposed Bags Flow

```
1. Generate vanity keypair (optional, suffix "pnl")
2. Upload metadata to Bags IPFS (or use imageUrl directly)
3. Configure fee sharing (creator + optional partners)
4. Build Bags launch transaction:
   - sdk.tokenLaunch.createTokenInfoAndMetadata
   - sdk.tokenLaunch.createBagsFeeShareConfig
   - sdk.tokenLaunch.createLaunchTransaction
5. Send via Jito bundle (MEV protection)
6. Call resolve_market with token address
7. Update database with pool address
```

---

## Fee Structure Comparison

### Pump.fun Fees
- **Trading Fee**: 1% on all buys/sells
- **Creator Portion**: Accumulated in `creatorVaultPda`
- **Claiming**: Single wallet claims all fees

### Bags Fees
- **Trading Fee**: Configurable (default ~1%)
- **Fee Distribution**: Up to 15 claimers without LUT, more with LUT
- **BPS Allocation**: Must total 10,000 (100%)
- **Claiming**: Each claimer claims their portion separately

---

## Migration Comparison

| Aspect | Pump.fun | Bags |
|--------|----------|------|
| **Target AMM** | Raydium | Meteora DAMM v1/v2 |
| **Threshold** | ~$69k market cap | Configurable |
| **Trigger** | Automatic | Automatic |
| **LP Tokens** | Burned | Lockable (can claim fees) |

---

## Testing Strategy

### Devnet Testing
1. Meteora DBC works on devnet: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
2. Create test pools with small amounts
3. Test fee claiming flow
4. Test migration to DAMM

### Mainnet Testing
1. Start with small initial buys (0.01-0.1 SOL)
2. Verify fee distribution
3. Monitor pool health

---

## Resources

### Official Documentation
- [Bags API Docs](https://docs.bags.fm)
- [Bags Launch Token Guide](https://docs.bags.fm/how-to-guides/launch-token)
- [Bags Program IDs](https://docs.bags.fm/principles/program-ids)
- [Bags Developer Portal](https://dev.bags.fm) - Get API Key

### SDKs & Code
- [Bags SDK (npm)](https://www.npmjs.com/package/@bagsfm/bags-sdk)
- [Bags SDK (GitHub)](https://github.com/bagsfm/bags-sdk)
- [Meteora DBC SDK (npm)](https://www.npmjs.com/package/@meteora-ag/dynamic-bonding-curve-sdk)
- [Meteora DBC SDK (GitHub)](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk)
- [Meteora DBC Program (GitHub)](https://github.com/MeteoraAg/dynamic-bonding-curve)

### Meteora Documentation
- [DBC Overview](https://docs.meteora.ag/product-overview/dynamic-bonding-curve-dbc-overview)
- [DBC TypeScript SDK Examples](https://docs.meteora.ag/developer-guide/guides/dbc/typescript-sdk/example-scripts)
- [Bonding Curve Formula](https://docs.meteora.ag/product-overview/dynamic-bonding-curve-dbc-overview/bonding-curve-formula)
- [Launchpad Template](https://docs.meteora.ag/integration/dynamic-bonding-curve-dbc-integration/launchpad-template)

### Third-Party APIs
- [Bitquery Bags FM API](https://docs.bitquery.io/docs/blockchain/Solana/bags-fm-api/) - Token tracking

---

## Recommended Implementation Order

1. **Get Bags API Key** from [dev.bags.fm](https://dev.bags.fm)
2. **Install SDKs**: `npm install @bagsfm/bags-sdk @meteora-ag/dynamic-bonding-curve-sdk`
3. **Create `/src/lib/bags.ts`** - Core utilities
4. **Update database models** - Add launchPlatform field
5. **Add platform selector** to project creation UI
6. **Implement Bags resolution flow** - New hook and API routes
7. **Update creator fee claiming** - Support both platforms
8. **Test on devnet** - Full flow validation
9. **Deploy to mainnet** - With feature flag

---

## Risk Considerations

1. **API Key Dependency**: Bags requires API key (Pump.fun doesn't)
2. **SDK Maturity**: Bags SDK is newer, may have breaking changes
3. **User Education**: Users need to understand platform differences
4. **Fee Complexity**: Multiple claimers adds UI complexity
5. **Migration Differences**: Different AMM targets may affect liquidity

---

## Conclusion

Adding Bags as an alternative launch platform provides:
- **Flexibility** for token creators to choose their preferred platform
- **Better fee sharing** options with multiple claimers
- **Customizable bonding curves** for different launch strategies
- **Devnet support** for thorough testing

The recommended approach is **client-side integration** (no smart contract changes) for MVP, with potential CPI integration in the future for better atomicity.
