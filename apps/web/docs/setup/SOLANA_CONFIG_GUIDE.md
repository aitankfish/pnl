# Solana Configuration Guide

## Auto-Switching Between Devnet and Mainnet

Your PLP platform now automatically switches between devnet and mainnet program IDs based on the `NEXT_PUBLIC_SOLANA_NETWORK` environment variable.

---

## Environment Variables

### Added to `.env`

```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet  # Change to "mainnet-beta" for production

# PLP Program IDs
NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET=2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G
NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET=YOUR_MAINNET_PROGRAM_ID_HERE
```

---

## Configuration File Created

**Location:** `src/config/solana.ts`

This file provides:
- ✅ Auto-switching program IDs
- ✅ Auto-switching RPC endpoints
- ✅ Network detection helpers
- ✅ PDA seed constants
- ✅ Fee constants
- ✅ Target pool options

---

## Usage in Your Code

### Import the Configuration

```typescript
import {
  PROGRAM_ID,           // Auto-switched program ID
  RPC_ENDPOINT,         // Auto-switched RPC endpoint
  SOLANA_NETWORK,       // Current network
  isMainnet,            // Check if mainnet
  isDevnet,             // Check if devnet
  PDA_SEEDS,            // PDA seeds
  FEES,                 // Fee constants
  TARGET_POOL_OPTIONS,  // Target pool options
  getConfig,            // Get full config
} from '@/config/solana';
```

### Example 1: Using Program ID

```typescript
import { PROGRAM_ID } from '@/config/solana';
import { PublicKey } from '@solana/web3.js';

// The program ID automatically switches based on network
const programId = PROGRAM_ID;
console.log('Program ID:', programId.toString());
```

### Example 2: Creating Connection

```typescript
import { Connection } from '@solana/web3.js';
import { RPC_ENDPOINT } from '@/config/solana';

// RPC endpoint automatically switches
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
```

### Example 3: Network-Specific Logic

```typescript
import { isMainnet, isDevnet, SOLANA_NETWORK } from '@/config/solana';

if (isMainnet()) {
  console.log('Running on mainnet - real SOL!');
  // Show warnings, disable test features, etc.
}

if (isDevnet()) {
  console.log('Running on devnet - test environment');
  // Enable test features, show devnet banner, etc.
}

// Or use the network string directly
console.log('Current network:', SOLANA_NETWORK);
```

### Example 4: Using Fee Constants

```typescript
import { FEES } from '@/config/solana';

// All fee constants in one place
const creationFee = FEES.CREATION; // 15_000_000 lamports (0.015 SOL)
const tradeFee = FEES.TRADE_BPS; // 150 (1.5%)
const completionFee = FEES.COMPLETION_BPS; // 500 (5%)
const minInvestment = FEES.MINIMUM_INVESTMENT; // 10_000_000 lamports (0.01 SOL)
```

### Example 5: Deriving PDAs

```typescript
import { PROGRAM_ID, PDA_SEEDS } from '@/config/solana';
import { PublicKey } from '@solana/web3.js';

// Derive Treasury PDA
const [treasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from(PDA_SEEDS.TREASURY)],
  PROGRAM_ID
);

// Derive Market PDA
const ipfsCid = 'QmYourIPFSHash';
const [marketPda] = PublicKey.findProgramAddressSync(
  [Buffer.from(PDA_SEEDS.MARKET), Buffer.from(ipfsCid)],
  PROGRAM_ID
);

// Derive Position PDA
const userPublicKey = new PublicKey('...');
const [positionPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from(PDA_SEEDS.POSITION),
    marketPda.toBuffer(),
    userPublicKey.toBuffer()
  ],
  PROGRAM_ID
);
```

### Example 6: Debug Configuration

```typescript
import { getConfig } from '@/config/solana';

// Get full configuration for debugging
const config = getConfig();
console.log('Solana Config:', config);
/* Output:
{
  network: 'devnet',
  programId: '2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G',
  rpcEndpoint: 'https://devnet.helius-rpc.com/?api-key=...',
  isMainnet: false,
  isDevnet: true
}
*/
```

---

## Switching Between Networks

### For Development (Devnet)

1. In `.env`, set:
   ```bash
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   ```

2. Restart your dev server:
   ```bash
   npm run dev
   ```

3. All code automatically uses devnet program ID and devnet RPC

### For Production (Mainnet)

1. Deploy your program to mainnet:
   ```bash
   solana config set --url mainnet-beta
   solana program deploy target/deploy/errors.so
   ```

2. Copy the mainnet program ID

3. Update `.env`:
   ```bash
   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
   NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET=<your_mainnet_program_id>
   ```

4. Restart your server:
   ```bash
   npm run build
   npm start
   ```

5. All code automatically uses mainnet program ID and mainnet RPC

---

## Configuration Constants Reference

### Networks

| Network | Value |
|---------|-------|
| Devnet | `"devnet"` |
| Mainnet | `"mainnet-beta"` |

### Program IDs

| Network | Program ID |
|---------|------------|
| Devnet | `2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G` |
| Mainnet | (Deploy when ready) |

### PDA Seeds

| Account Type | Seed |
|--------------|------|
| Treasury | `"treasury"` |
| Market | `"market"` |
| Position | `"position"` |

### Fees (in lamports)

| Fee Type | Amount | Percentage |
|----------|--------|------------|
| Creation | 15,000,000 | 0.015 SOL |
| Trade | 150 BPS | 1.5% |
| Completion | 500 BPS | 5% |
| Minimum Investment | 10,000,000 | 0.01 SOL |

### Target Pool Options (in lamports)

| Option | Amount |
|--------|--------|
| Small | 5,000,000,000 (5 SOL) |
| Medium | 10,000,000,000 (10 SOL) |
| Large | 15,000,000,000 (15 SOL) |

---

## Best Practices

### 1. Always Use Config Constants

❌ **Bad:**
```typescript
const programId = new PublicKey('2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G');
```

✅ **Good:**
```typescript
import { PROGRAM_ID } from '@/config/solana';
const programId = PROGRAM_ID;
```

### 2. Check Network Before Sensitive Operations

```typescript
import { isMainnet } from '@/config/solana';

async function createMarket() {
  if (isMainnet()) {
    // Show warning: "This will use real SOL!"
    const confirmed = await showWarningDialog();
    if (!confirmed) return;
  }

  // Proceed with market creation
}
```

### 3. Use Environment-Specific UI

```typescript
import { isDevnet } from '@/config/solana';

function Header() {
  return (
    <header>
      {isDevnet() && (
        <div className="bg-yellow-500 text-black px-4 py-2">
          ⚠️ You are on DEVNET - This is a test environment
        </div>
      )}
      {/* Rest of header */}
    </header>
  );
}
```

### 4. Log Configuration in Development

The config automatically logs on load in development mode:

```
🔧 Solana Configuration: {
  network: 'devnet',
  programId: '2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G',
  rpcEndpoint: 'https://devnet.helius-rpc.com/?api-key=...',
  isMainnet: false,
  isDevnet: true
}
```

---

## Testing the Configuration

### Test Script

Create `scripts/test-config.ts`:

```typescript
import { getConfig, isDevnet, isMainnet, PROGRAM_ID } from '../src/config/solana';

console.log('=== Solana Configuration Test ===\n');

const config = getConfig();

console.log('Network:', config.network);
console.log('Program ID:', config.programId);
console.log('RPC Endpoint:', config.rpcEndpoint);
console.log('Is Mainnet:', config.isMainnet);
console.log('Is Devnet:', config.isDevnet);

console.log('\n=== Checks ===');
console.log('isDevnet():', isDevnet());
console.log('isMainnet():', isMainnet());

console.log('\n=== Expected ===');
console.log('For devnet, PROGRAM_ID should be: 2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G');
console.log('Current PROGRAM_ID:', PROGRAM_ID.toString());
```

Run with:
```bash
npx ts-node scripts/test-config.ts
```

---

## Migration Guide

If you have existing hardcoded program IDs, replace them:

### Before

```typescript
// Old hardcoded approach
const programId = new PublicKey('3jGpj7HYo3jctBApnjwZGW54hJCpNHooFfu5533WvXr4');
const rpcUrl = 'https://api.devnet.solana.com';
```

### After

```typescript
// New auto-switching approach
import { PROGRAM_ID, RPC_ENDPOINT } from '@/config/solana';

const programId = PROGRAM_ID;
const rpcUrl = RPC_ENDPOINT;
```

---

## Troubleshooting

### Issue: "Program ID not configured for mainnet-beta"

**Cause:** You set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta` but haven't deployed to mainnet yet.

**Solution:**
1. Either switch back to devnet: `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
2. Or deploy to mainnet and update `NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET`

### Issue: Configuration not updating

**Solution:** Restart your Next.js dev server:
```bash
# Stop the server (Ctrl+C)
npm run dev
```

### Issue: Wrong program ID being used

**Solution:** Check your `.env` file and verify:
1. `NEXT_PUBLIC_SOLANA_NETWORK` is set correctly
2. The corresponding program ID is set
3. You've restarted the dev server

---

## Summary

✅ **Environment variables added** to `.env` and `.env.example`
✅ **Configuration file created** at `src/config/solana.ts`
✅ **Auto-switching enabled** based on `NEXT_PUBLIC_SOLANA_NETWORK`
✅ **All constants centralized** for easy maintenance
✅ **Type-safe** with TypeScript
✅ **Ready for mainnet** when you deploy

Just change one environment variable to switch between devnet and mainnet! 🚀
