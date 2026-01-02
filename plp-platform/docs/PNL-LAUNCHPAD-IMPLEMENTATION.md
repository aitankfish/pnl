# PNL Launchpad Implementation Plan

## Overview

Create a custom **PNL Launchpad** using Raydium LaunchLab infrastructure, while maintaining the existing Pump.fun integration. This makes PLP both an aggregator AND a launchpad competitor (like LetsBONK did with Raydium).

---

## Architecture Comparison

| Aspect | Pump.fun (Current) | PNL Launchpad (New) |
|--------|-------------------|---------------------|
| Backend | Pump.fun program | Raydium LaunchLab |
| Integration | PumpPortal API | Raydium SDK |
| Token Standard | Token2022 | Token2022 |
| Bonding Curve | Pump's curve | Configurable |
| Graduation | ~85 SOL to Raydium | Configurable (30-300 SOL) |
| Platform Fees | 1% (to Pump.fun) | Custom (100% to PLP) |
| LP Ownership | Pump.fun burns | PLP controls (40/50/10 split) |

---

## Key Benefits of PNL Launchpad

1. **Revenue Capture**: All fees go to PLP platform, not Pump.fun
2. **LP Control**: Platform, creator, and burn splits are configurable
3. **Brand Identity**: "Launched on PNL" vs "Launched on Pump.fun"
4. **Customization**: Bonding curve params, graduation thresholds
5. **Better Economics**: No middleman fees

---

## PNL Tokenomics Model

### The Core Difference: Mint vs Buy

**Pump.fun Model (Current):**
```
Pool raised: 10 SOL
         ↓
Buy tokens on Pump.fun bonding curve
         ↓
Get ~200-250M tokens (curve price determines amount)
         ↓
Distribute 65/33/2 of PURCHASED tokens
         ↓
Voters get ~13-16% of total 1B supply
```

**PNL Model (New):**
```
Pool raised: 10 SOL
         ↓
MINT tokens (we control supply)
         ↓
Allocate 50% to liquidity pool + raised SOL
Allocate 50% directly to voters/founder/platform
         ↓
Voters get 32.5% of total supply (2.5x more!)
```

### Token Supply Allocation

| Allocation | Percentage | Purpose |
|------------|------------|---------|
| Liquidity Pool | 50% | Paired with raised SOL for trading |
| Distribution Pool | 50% | Split among voters/founder/platform |

**Distribution Pool Breakdown (same ratios as current):**

| Recipient | % of Distribution | % of Total Supply |
|-----------|-------------------|-------------------|
| YES Voters | 65% | 32.5% |
| Founder | 33% | 16.5% |
| Platform | 2% | 1.0% |

### Dynamic Supply Formula

Instead of fixed 1B tokens, supply scales with pool size:

```
Total Supply = Pool Raised (SOL) × 10,000,000
```

| Pool Raised | Total Supply | Liquidity Tokens | Voter Allocation |
|-------------|--------------|------------------|------------------|
| 5 SOL | 50M | 25M | 16.25M (32.5%) |
| 10 SOL | 100M | 50M | 32.5M (32.5%) |
| 15 SOL | 150M | 75M | 48.75M (32.5%) |
| 25 SOL | 250M | 125M | 81.25M (32.5%) |
| 50 SOL | 500M | 250M | 162.5M (32.5%) |

### Virtual Liquidity for Proper Market Cap

**Problem:** Without virtual liquidity, initial market cap is too low.

```
10 SOL pool + 50M tokens in liquidity
Price = 10 / 50,000,000 = 0.0000002 SOL
Market Cap = 100M × 0.0000002 = 20 SOL (~$3,000)
```

This feels "dead" compared to Pump.fun's ~$15k starting MC.

**Solution:** Add virtual SOL reserves (4x multiplier) for pricing only.

```
Real liquidity: 10 SOL
Virtual boost: 40 SOL (for price calculation only)
Effective reserves: 50 SOL

Price = 50 / 50,000,000 = 0.000001 SOL
Market Cap = 100M × 0.000001 = 100 SOL (~$15,000)
```

### Market Cap Comparison

| Pool Size | PNL (with 4x virtual) | Pump.fun (at same SOL) |
|-----------|----------------------|------------------------|
| 5 SOL | ~25 SOL ($3.7k) | ~$5k MC |
| 10 SOL | ~50 SOL ($7.5k) | ~$15k MC |
| 15 SOL | ~75 SOL ($11k) | ~$25k MC |
| 25 SOL | ~125 SOL ($19k) | ~$40k MC |
| 50 SOL | ~250 SOL ($37k) | ~$60k MC |

### Voter Advantage: PNL vs Pump.fun

| Metric | Pump.fun | PNL | Improvement |
|--------|----------|-----|-------------|
| Voter % of supply | ~13-16% | 32.5% | **2-2.5x more tokens** |
| Entry price | Curve price (higher) | Creation price (lowest) | **Better entry** |
| Bot competition | High (snipers) | None (pre-allocated) | **Fair distribution** |
| Creator LP | 0% | 50% | **Creator aligned** |

### Tokenomics Constants

```typescript
// src/lib/constants/tokenomics.ts

export const PNL_TOKENOMICS = {
  // Supply calculation
  SUPPLY_MULTIPLIER: 10_000_000,  // Supply = Pool SOL × this

  // Allocation split
  LIQUIDITY_SHARE: 0.50,          // 50% to AMM pool
  DISTRIBUTION_SHARE: 0.50,       // 50% to distribute

  // Distribution breakdown (of the 50%)
  VOTER_SHARE: 0.65,              // 65% → 32.5% of total
  FOUNDER_SHARE: 0.33,            // 33% → 16.5% of total
  PLATFORM_SHARE: 0.02,           // 2%  → 1.0% of total

  // Virtual liquidity for MC
  VIRTUAL_SOL_MULTIPLIER: 4,      // 4x virtual boost

  // Token decimals
  DECIMALS: 6,
};

// Calculate allocations
export function calculateTokenomics(poolSol: number) {
  const totalSupply = poolSol * PNL_TOKENOMICS.SUPPLY_MULTIPLIER;
  const liquidityTokens = totalSupply * PNL_TOKENOMICS.LIQUIDITY_SHARE;
  const distributionTokens = totalSupply * PNL_TOKENOMICS.DISTRIBUTION_SHARE;

  return {
    totalSupply,
    liquidity: {
      tokens: liquidityTokens,
      sol: poolSol,
    },
    distribution: {
      voters: distributionTokens * PNL_TOKENOMICS.VOTER_SHARE,
      founder: distributionTokens * PNL_TOKENOMICS.FOUNDER_SHARE,
      platform: distributionTokens * PNL_TOKENOMICS.PLATFORM_SHARE,
    },
    pricing: {
      virtualSol: poolSol * PNL_TOKENOMICS.VIRTUAL_SOL_MULTIPLIER,
      effectiveSol: poolSol * (1 + PNL_TOKENOMICS.VIRTUAL_SOL_MULTIPLIER),
      pricePerToken: (poolSol * (1 + PNL_TOKENOMICS.VIRTUAL_SOL_MULTIPLIER)) / liquidityTokens,
      marketCap: totalSupply * ((poolSol * (1 + PNL_TOKENOMICS.VIRTUAL_SOL_MULTIPLIER)) / liquidityTokens),
    },
  };
}
```

### Example: 10 SOL Pool

```
Pool Raised: 10 SOL

Token Creation:
├── Total Supply: 100,000,000 tokens
├── Liquidity Pool: 50,000,000 tokens + 10 SOL
└── Distribution: 50,000,000 tokens
    ├── YES Voters: 32,500,000 (32.5% of supply)
    ├── Founder: 16,500,000 (16.5% of supply)
    └── Platform: 1,000,000 (1.0% of supply)

Pricing (with 4x virtual boost):
├── Virtual SOL: 40 SOL
├── Effective reserves: 50 SOL
├── Price: 0.000001 SOL per token
└── Market Cap: 100 SOL (~$15,000)

Voter Example:
├── Voted: 1 SOL (10% of pool)
├── Receives: 3,250,000 tokens (10% of voter pool)
├── Position value at launch: ~$1,500
└── If 10x: Position worth ~$15,000
```

### Smart Contract Implementation

```rust
// plp_program/programs/errors/src/instructions/resolve_market_pnl.rs

/// PNL Tokenomics constants
pub const SUPPLY_MULTIPLIER: u64 = 10_000_000;
pub const LIQUIDITY_BPS: u64 = 5000;      // 50%
pub const VOTER_BPS: u64 = 3250;          // 32.5% of total (65% of 50%)
pub const FOUNDER_BPS: u64 = 1650;        // 16.5% of total (33% of 50%)
pub const PLATFORM_BPS: u64 = 100;        // 1.0% of total (2% of 50%)
pub const VIRTUAL_MULTIPLIER: u64 = 4;    // 4x virtual boost
pub const BPS_DIVISOR: u64 = 10000;

pub fn calculate_pnl_tokenomics(pool_lamports: u64) -> PnlTokenomics {
    let pool_sol = pool_lamports / LAMPORTS_PER_SOL;
    let total_supply = pool_sol * SUPPLY_MULTIPLIER;

    let liquidity_tokens = (total_supply * LIQUIDITY_BPS) / BPS_DIVISOR;
    let voter_tokens = (total_supply * VOTER_BPS) / BPS_DIVISOR;
    let founder_tokens = (total_supply * FOUNDER_BPS) / BPS_DIVISOR;
    let platform_tokens = (total_supply * PLATFORM_BPS) / BPS_DIVISOR;

    PnlTokenomics {
        total_supply,
        liquidity_tokens,
        liquidity_sol: pool_lamports,
        voter_tokens,
        founder_tokens,
        platform_tokens,
        virtual_sol: pool_lamports * VIRTUAL_MULTIPLIER,
    }
}
```

---

## Implementation Phases

### Phase 1: Platform Registration (1-2 days)

Create the PNL platform configuration on Raydium LaunchLab.

**SDK: `@raydium-io/raydium-sdk-v2`**

```typescript
// src/lib/launchpads/pnl/createPlatform.ts
import { Raydium, TxVersion } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

// Program IDs
const LAUNCHLAB_MAINNET = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
const LAUNCHLAB_DEVNET = new PublicKey('DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6');

interface PNLPlatformConfig {
  platformAdmin: PublicKey;        // PLP admin wallet
  claimFeeWallet: PublicKey;       // Where trading fees go
  lockNftWallet: PublicKey;        // Where locked LP NFTs go
  vestingWallet: PublicKey;        // For vested token releases

  // Fee structure (in basis points, 10000 = 100%)
  platformFeeRate: number;         // Fee on trades (e.g., 100 = 1%)
  creatorFeeRate: number;          // Creator share of fees

  // LP distribution after graduation
  platformLpShare: number;         // Platform gets (e.g., 40%)
  creatorLpShare: number;          // Creator gets (e.g., 50%)
  burnLpShare: number;             // Burned (e.g., 10%)
}

export async function createPNLPlatform(
  connection: Connection,
  owner: Keypair,
  config: PNLPlatformConfig,
  isDevnet: boolean = false
): Promise<{ platformId: PublicKey; txId: string }> {

  const raydium = await Raydium.load({
    connection,
    owner,
    cluster: isDevnet ? 'devnet' : 'mainnet',
  });

  // Get CP pool config from Raydium API
  const cpConfigId = await getCpConfigId(isDevnet);

  const { execute, extInfo } = await raydium.launchpad.createPlatformConfig({
    programId: isDevnet ? LAUNCHLAB_DEVNET : LAUNCHLAB_MAINNET,

    // Admin and wallets
    platformAdmin: config.platformAdmin,
    platformClaimFeeWallet: config.claimFeeWallet,
    platformLockNftWallet: config.lockNftWallet,
    platformVestingWallet: config.vestingWallet,

    // Fees
    feeRate: new BN(config.platformFeeRate),
    creatorFeeRate: new BN(config.creatorFeeRate),

    // LP distribution after migration to AMM
    migrateCpLockNftScale: {
      platform: config.platformLpShare,   // 40
      creator: config.creatorLpShare,      // 50
      burn: config.burnLpShare,            // 10
    },

    // Pool config reference
    cpConfigId,

    // Metadata
    name: 'PNL Launchpad',
    web: 'https://pnl.markets',
    img: 'https://pnl.markets/logo.png',

    txVersion: TxVersion.V0,
  });

  const txId = await execute();
  const platformId = extInfo.platformId;

  console.log('✅ PNL Platform created!');
  console.log('   Platform ID:', platformId.toBase58());
  console.log('   Transaction:', txId);

  return { platformId, txId };
}

async function getCpConfigId(isDevnet: boolean): Promise<PublicKey> {
  const endpoint = isDevnet
    ? 'https://api-v3.raydium.io/main/cpmm-config'
    : 'https://api-v3.raydium.io/main/cpmm-config';

  const response = await fetch(endpoint);
  const data = await response.json();

  // Return the default config ID
  return new PublicKey(data.data[0].id);
}
```

**One-Time Setup Script:**
```bash
# Run once to register PNL platform
npx ts-node scripts/create-pnl-platform.ts
```

**IMPORTANT**: Each wallet can only create ONE platform config. Use a dedicated admin wallet.

---

### Phase 2: Database Schema Update (1 day)

Update MongoDB schema to support multiple launchpads.

```typescript
// src/lib/database/models.ts

export type LaunchpadType = 'pump_fun' | 'pnl';

export interface PredictionMarket {
  // ... existing fields ...

  // NEW: Launchpad selection
  launchpadType: LaunchpadType;

  // Generic token address (works for any launchpad)
  tokenAddress?: string;

  // Deprecated but kept for backward compatibility
  pumpFunTokenAddress?: string;
}
```

**Migration Script:**
```typescript
// scripts/migrate-launchpad-field.ts
await db.collection('markets').updateMany(
  { launchpadType: { $exists: false } },
  {
    $set: { launchpadType: 'pump_fun' },
    $rename: { pumpFunTokenAddress: 'tokenAddress' }
  }
);
```

---

### Phase 3: Smart Contract Update (3-5 days)

Add Raydium LaunchLab CPI to the PLP Anchor program.

#### 3a. Add CPI Dependency

```toml
# plp_program/programs/errors/Cargo.toml

[dependencies]
anchor-lang = "=0.31.0"
anchor-spl = "=0.31.0"

# Raydium LaunchLab CPI
raydium-launch-cpi = {
  git = "https://github.com/raydium-io/raydium-cpi",
  package = "raydium-launch-cpi",
  branch = "anchor-0.31.0"
}
```

#### 3b. Update Market State

```rust
// plp_program/programs/errors/src/state/market.rs

/// Launchpad type for token creation
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum LaunchpadType {
    PumpFun = 0,
    Pnl = 1,      // Raydium LaunchLab
}

impl Default for LaunchpadType {
    fn default() -> Self {
        LaunchpadType::PumpFun
    }
}

#[account]
pub struct Market {
    // ... existing fields ...

    /// Launchpad type (0=PumpFun, 1=PNL)
    pub launchpad_type: LaunchpadType,
}
```

#### 3c. Create Raydium CPI Module

```rust
// plp_program/programs/errors/src/cpi/raydium_launchlab.rs

use anchor_lang::prelude::*;
use raydium_launch_cpi::{
    cpi::{accounts::CreatePool, create_pool},
    program::RaydiumLaunchpad,
    state::PlatformConfig,
};

/// PNL Platform Config (set after one-time registration)
pub const PNL_PLATFORM_ID: &str = "YOUR_PLATFORM_ID_HERE";

/// Raydium LaunchLab Program IDs
pub const LAUNCHLAB_MAINNET: &str = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
pub const LAUNCHLAB_DEVNET: &str = "DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6";

/// Create token on PNL Launchpad (Raydium LaunchLab)
pub fn create_pnl_token<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, CreatePool<'info>>,
    name: String,
    symbol: String,
    uri: String,
    decimals: u8,
    migration_supply: u64,
) -> Result<()> {
    create_pool(ctx, name, symbol, uri, decimals, migration_supply)
}

/// Derive PNL LaunchLab PDAs
pub fn derive_launchlab_pdas(
    mint: &Pubkey,
    platform_id: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, Pubkey, Pubkey) {
    // Pool PDA
    let (pool_id, _) = Pubkey::find_program_address(
        &[b"pool", platform_id.as_ref(), mint.as_ref()],
        program_id,
    );

    // Pool token vault
    let (vault, _) = Pubkey::find_program_address(
        &[b"vault", pool_id.as_ref()],
        program_id,
    );

    // Curve state
    let (curve, _) = Pubkey::find_program_address(
        &[b"curve", pool_id.as_ref()],
        program_id,
    );

    (pool_id, vault, curve)
}
```

#### 3d. Update resolve_market Instruction

```rust
// plp_program/programs/errors/src/instructions/resolve_market.rs

// Add Raydium accounts (only used when launchpad_type == Pnl)
/// Raydium LaunchLab program
/// CHECK: Only validated when using PNL launchpad
pub raydium_program: Option<UncheckedAccount<'info>>,

/// PNL Platform config
/// CHECK: Only validated when using PNL launchpad
pub pnl_platform: Option<UncheckedAccount<'info>>,

/// Raydium pool PDA
/// CHECK: Only validated when using PNL launchpad
#[account(mut)]
pub raydium_pool: Option<UncheckedAccount<'info>>,

// ... in handler ...

match market.launchpad_type {
    LaunchpadType::PumpFun => {
        // Existing pump.fun CPI logic (unchanged)
        execute_pump_fun_buy(ctx, market, net_amount_for_token)?;
    }
    LaunchpadType::Pnl => {
        // New Raydium LaunchLab CPI
        execute_pnl_buy(ctx, market, net_amount_for_token)?;
    }
}
```

---

### Phase 4: Frontend Launchpad Selector (2 days)

#### 4a. Create Launchpad Selector Component

```tsx
// src/components/LaunchpadSelector.tsx

'use client';

import React from 'react';
import Image from 'next/image';

export type LaunchpadType = 'pump_fun' | 'pnl';

interface LaunchpadOption {
  id: LaunchpadType;
  name: string;
  description: string;
  logo: string;
  features: string[];
  recommended?: boolean;
}

const LAUNCHPAD_OPTIONS: LaunchpadOption[] = [
  {
    id: 'pnl',
    name: 'PNL Launchpad',
    description: 'Native PLP launchpad powered by Raydium',
    logo: '/pnl-logo.svg',
    features: [
      '100% fees to PLP ecosystem',
      'Custom bonding curve',
      'LP ownership to creator',
    ],
    recommended: true,
  },
  {
    id: 'pump_fun',
    name: 'Pump.fun',
    description: 'Original memecoin launchpad',
    logo: '/pumpfun-logo.svg',
    features: [
      'Largest liquidity pool',
      'Most recognizable',
      'Established ecosystem',
    ],
  },
];

interface Props {
  value: LaunchpadType;
  onChange: (value: LaunchpadType) => void;
}

export function LaunchpadSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-white/80">
        Choose Launchpad
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {LAUNCHPAD_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`
              relative p-4 rounded-xl border text-left transition-all
              ${value === option.id
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
              }
            `}
          >
            {option.recommended && (
              <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full">
                Recommended
              </span>
            )}

            <div className="flex items-start gap-3">
              <Image
                src={option.logo}
                alt={option.name}
                width={32}
                height={32}
                className="rounded-lg"
              />
              <div>
                <h3 className="font-semibold text-white">{option.name}</h3>
                <p className="text-xs text-white/60 mt-0.5">{option.description}</p>
              </div>
            </div>

            <ul className="mt-3 space-y-1">
              {option.features.map((feature, i) => (
                <li key={i} className="text-xs text-white/50 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-cyan-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### 4b. Update Create Market Form

```tsx
// src/app/create/page.tsx

import { LaunchpadSelector, LaunchpadType } from '@/components/LaunchpadSelector';

// Add to form state
const [launchpadType, setLaunchpadType] = useState<LaunchpadType>('pnl');

// Add to form JSX (after existing fields)
<LaunchpadSelector
  value={launchpadType}
  onChange={setLaunchpadType}
/>

// Include in API call
const response = await fetch('/api/projects/create', {
  method: 'POST',
  body: JSON.stringify({
    ...formData,
    launchpadType,
  }),
});
```

---

### Phase 5: Launchpad Service Abstraction (2 days)

Create a unified interface for different launchpads.

```typescript
// src/lib/launchpads/types.ts

import { PublicKey, VersionedTransaction } from '@solana/web3.js';

export interface LaunchpadService {
  name: string;
  programId: PublicKey;

  // Build create token transaction
  buildCreateTransaction(params: {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    mint: PublicKey;
    creator: PublicKey;
  }): Promise<VersionedTransaction>;

  // Derive all accounts needed for resolution
  getResolveAccounts(params: {
    marketAddress: PublicKey;
    tokenMint: PublicKey;
  }): Promise<Record<string, PublicKey>>;

  // Get token page URL
  getTokenUrl(tokenAddress: string): string;
}
```

```typescript
// src/lib/launchpads/pump-fun.ts

import { LaunchpadService } from './types';
import { PUMP_PROGRAM_ID, getPumpCreateInstruction, derivePumpPDAs } from '../pumpfun';

export const pumpFunService: LaunchpadService = {
  name: 'Pump.fun',
  programId: PUMP_PROGRAM_ID,

  async buildCreateTransaction(params) {
    return getPumpCreateInstruction(params);
  },

  async getResolveAccounts({ marketAddress, tokenMint }) {
    const pdas = derivePumpPDAs(tokenMint);
    return {
      pumpGlobal: pdas.global,
      bondingCurve: pdas.bondingCurve,
      // ... other accounts
    };
  },

  getTokenUrl(tokenAddress: string) {
    return `https://pump.fun/${tokenAddress}`;
  },
};
```

```typescript
// src/lib/launchpads/pnl.ts

import { Raydium } from '@raydium-io/raydium-sdk-v2';
import { LaunchpadService } from './types';

const PNL_PLATFORM_ID = new PublicKey('YOUR_PLATFORM_ID');
const LAUNCHLAB_PROGRAM = new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');

export const pnlService: LaunchpadService = {
  name: 'PNL Launchpad',
  programId: LAUNCHLAB_PROGRAM,

  async buildCreateTransaction(params) {
    const raydium = await Raydium.load({ ... });

    const { transaction } = await raydium.launchpad.createLaunchpad({
      programId: LAUNCHLAB_PROGRAM,
      platformId: PNL_PLATFORM_ID,
      name: params.name,
      symbol: params.symbol,
      uri: params.imageUrl, // Metadata URI
      decimals: 6,
      createOnly: true,
    });

    return transaction;
  },

  async getResolveAccounts({ marketAddress, tokenMint }) {
    // Derive Raydium PDAs
    const [poolId] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), PNL_PLATFORM_ID.toBuffer(), tokenMint.toBuffer()],
      LAUNCHLAB_PROGRAM
    );

    return {
      raydiumProgram: LAUNCHLAB_PROGRAM,
      pnlPlatform: PNL_PLATFORM_ID,
      raydiumPool: poolId,
      // ... other Raydium accounts
    };
  },

  getTokenUrl(tokenAddress: string) {
    return `https://pnl.markets/token/${tokenAddress}`;
  },
};
```

```typescript
// src/lib/launchpads/index.ts

import { LaunchpadType } from '@/components/LaunchpadSelector';
import { LaunchpadService } from './types';
import { pumpFunService } from './pump-fun';
import { pnlService } from './pnl';

const LAUNCHPAD_REGISTRY: Record<LaunchpadType, LaunchpadService> = {
  pump_fun: pumpFunService,
  pnl: pnlService,
};

export function getLaunchpadService(type: LaunchpadType): LaunchpadService {
  return LAUNCHPAD_REGISTRY[type];
}
```

---

## API Changes

### Create Market Endpoint

```typescript
// src/app/api/projects/create/route.ts

export async function POST(req: Request) {
  const body = await req.json();
  const { launchpadType = 'pnl', ...projectData } = body;

  // Validate launchpad type
  if (!['pump_fun', 'pnl'].includes(launchpadType)) {
    return Response.json({ error: 'Invalid launchpad type' }, { status: 400 });
  }

  // Store in database
  const market = await db.markets.create({
    ...projectData,
    launchpadType,
  });

  return Response.json({ success: true, market });
}
```

### Resolve Market Endpoint

```typescript
// src/app/api/markets/resolve/prepare/route.ts

import { getLaunchpadService } from '@/lib/launchpads';

export async function POST(req: Request) {
  const { marketAddress } = await req.json();

  // Get market from database
  const market = await db.markets.findOne({ marketAddress });

  // Get launchpad-specific accounts
  const service = getLaunchpadService(market.launchpadType);
  const accounts = await service.getResolveAccounts({
    marketAddress: new PublicKey(marketAddress),
    tokenMint: new PublicKey(market.pendingTokenMint),
  });

  return Response.json({ accounts });
}
```

---

## Raydium SDK Reference

### Installation

```bash
npm install @raydium-io/raydium-sdk-v2
```

### Key Methods

| Method | Purpose |
|--------|---------|
| `raydium.launchpad.createPlatformConfig()` | One-time platform registration |
| `raydium.launchpad.createLaunchpad()` | Create token + pool |
| `raydium.launchpad.buyToken()` | Buy tokens on bonding curve |
| `raydium.launchpad.sellToken()` | Sell tokens on bonding curve |
| `raydium.launchpad.claimPlatformFee()` | Claim accumulated fees |

### Resources

- **SDK Demo**: https://github.com/raydium-io/raydium-sdk-V2-demo/tree/master/src/launchpad
- **CPI Crate**: https://github.com/raydium-io/raydium-cpi (branch: anchor-0.31.0)
- **CPI Examples**: https://github.com/raydium-io/raydium-cpi-example

---

## Configuration Constants

```typescript
// src/lib/constants/launchpads.ts

export const LAUNCHPAD_CONFIG = {
  pnl: {
    programId: {
      mainnet: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
      devnet: 'DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6',
    },
    platformId: {
      mainnet: 'YOUR_MAINNET_PLATFORM_ID', // Set after registration
      devnet: 'YOUR_DEVNET_PLATFORM_ID',
    },
    feeRate: 100,        // 1% trading fee
    graduationSol: 30,   // 30 SOL to graduate
    lpSplit: {
      platform: 40,      // 40% to PLP treasury
      creator: 50,       // 50% to project founder
      burn: 10,          // 10% burned
    },
  },
  pump_fun: {
    programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    feeRecipient: 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM',
  },
};
```

---

## Testing Strategy

### Devnet Testing

1. **Create test platform** on Raydium devnet
2. **Deploy upgraded program** to devnet
3. **Create test market** with PNL launchpad
4. **Resolve market** → Verify token creation
5. **Check LP distribution** → Verify 40/50/10 split

```bash
# Build for devnet
cd plp_program
anchor build -- --features devnet

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Mainnet Deployment

1. Deploy upgraded program (requires multisig)
2. Register PNL platform (one-time)
3. Update frontend to default to PNL
4. Monitor first few launches closely

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Smart contract bug | Extensive devnet testing + audit |
| CPI failure | Fallback to pump.fun option |
| Raydium API downtime | Cache platform config locally |
| Transaction size | Use Address Lookup Tables |

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Platform Registration | 1-2 days | None |
| 2. Database Schema | 1 day | Phase 1 |
| 3. Smart Contract | 3-5 days | Phase 1 |
| 4. Frontend UI | 2 days | Phase 2 |
| 5. Service Abstraction | 2 days | Phase 3, 4 |
| **Total** | **~10-12 days** | |

---

## Next Steps

1. [ ] Create PLP admin wallet for platform registration
2. [ ] Register PNL platform on devnet first
3. [ ] Add `raydium-launch-cpi` to smart contract
4. [ ] Implement launchpad routing in `resolve_market`
5. [ ] Build frontend launchpad selector
6. [ ] Test full flow on devnet
7. [ ] Deploy to mainnet

---

## Files to Modify

### Smart Contract
- `plp_program/programs/errors/Cargo.toml` - Add Raydium CPI
- `plp_program/programs/errors/src/state/market.rs` - Add LaunchpadType
- `plp_program/programs/errors/src/instructions/create_market.rs` - Accept launchpad param
- `plp_program/programs/errors/src/instructions/resolve_market.rs` - Launchpad routing
- NEW: `plp_program/programs/errors/src/cpi/raydium_launchlab.rs`

### Database
- `src/lib/database/models.ts` - Add launchpadType field

### Frontend
- `src/app/create/page.tsx` - Add launchpad selector
- NEW: `src/components/LaunchpadSelector.tsx`
- NEW: `src/lib/launchpads/pnl.ts`
- NEW: `src/lib/launchpads/types.ts`
- NEW: `src/lib/launchpads/index.ts`

### API
- `src/app/api/projects/create/route.ts` - Accept launchpadType
- `src/app/api/markets/resolve/prepare/route.ts` - Dynamic accounts
