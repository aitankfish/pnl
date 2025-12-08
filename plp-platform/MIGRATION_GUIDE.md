# Market Vault Migration Guide

## Overview

This guide explains how to migrate existing markets to the new Market Vault PDA system after upgrading the program.

## What Changed?

### Before (Old System)
- Market PDA held both market data AND SOL from votes
- **Problem**: Data accounts cannot transfer SOL using System Program
- **Error**: "Transfer: `from` must not carry data"

### After (New System)
- **Market PDA**: Stores only market data (458 bytes)
- **Market Vault PDA**: Stores only SOL (0 bytes) - separate account
- All SOL transfers use the vault PDA

## Why Migration is Needed

Markets created before the vault system was implemented:
1. Don't have a `market_vault` PDA
2. May have SOL stuck in the market account
3. Cannot use `buy_yes`, `buy_no`, or `resolve_market` instructions with the new code

## Migration Process

### Step 1: Deploy Upgraded Program

```bash
# Build the program
cd plp_program
cargo build-sbf

# Deploy to mainnet
solana program deploy --program-id C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86 \
  target/deploy/plp_prediction_market.so \
  --url mainnet-beta
```

### Step 2: Get Market Address

Find the address of the market you want to migrate. You can:
- Check your database
- Use Solscan to find markets created by a founder
- Query on-chain accounts

### Step 3: Run Migration Script

The migration script will:
1. Create the `market_vault` PDA for the existing market
2. Transfer any SOL from the market account to the vault
3. Make the market compatible with the new code

**Run the script:**

```bash
npx tsx scripts/migrate-market.ts <MARKET_ADDRESS>
```

**Example:**
```bash
npx tsx scripts/migrate-market.ts 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### Step 4: Verify Migration

The script will show:
- ✅ Vault created successfully
- ✅ SOL transferred (if any)
- Final balances of market and vault

**Check on Solscan:**
1. Go to the market address on Solscan
2. Look for the vault PDA in recent transactions
3. Verify vault has the expected SOL balance

## Migration Instruction Details

### Who Can Call It?
Anyone can call `migrate_market` - it's permissionless and safe.

### Is it Idempotent?
Yes! Calling it multiple times is safe. If the vault already exists, it will:
- Skip vault creation
- Log that migration was already completed
- Exit successfully without changes

### Cost
- ~0.001 SOL (rent-exempt minimum for vault PDA)
- Plus small transaction fee (~0.000005 SOL)

### Accounts Required

```typescript
{
  market: PublicKey,        // Existing market account (mut)
  market_vault: PublicKey,  // Vault PDA to create (mut)
  payer: Signer,            // Pays for vault rent (mut)
  system_program: PublicKey // System program
}
```

### Vault PDA Derivation

```typescript
// TypeScript
import { getMarketVaultPDA } from '@/lib/anchor-program';

const [vaultPda, bump] = getMarketVaultPDA(marketPubkey, 'mainnet-beta');
```

```rust
// Rust
let (vault_pda, bump) = Pubkey::find_program_address(
    &[b"market_vault", market.key().as_ref()],
    &program_id
);
```

## Manual Migration (Without Script)

If you prefer to call the instruction manually:

```typescript
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getMarketVaultPDA } from '@/lib/anchor-program';

const PROGRAM_ID = new PublicKey('C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86');

async function migrateMarket(marketPubkey: PublicKey, payer: Keypair) {
  const connection = new Connection(RPC_URL);

  // Derive vault PDA
  const [vaultPda] = getMarketVaultPDA(marketPubkey, 'mainnet-beta');

  // Build instruction (discriminator from IDL)
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: marketPubkey, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from([...MIGRATE_MARKET_DISCRIMINATOR]), // Get from IDL
  });

  // Send transaction
  const tx = new Transaction().add(ix);
  const signature = await connection.sendTransaction(tx, [payer]);
  await connection.confirmTransaction(signature);

  console.log('Migration complete:', signature);
}
```

## Troubleshooting

### Error: "Insufficient balance"
Your payer wallet needs at least 0.01 SOL to cover rent and fees.

**Solution:** Add SOL to the payer wallet.

### Error: "Market account not found"
The market address you provided doesn't exist on-chain.

**Solution:** Double-check the market address.

### Warning: "Market vault already exists"
The migration has already been completed for this market.

**Action:** No action needed! The instruction is idempotent.

### Error: "Invalid instruction discriminator"
The script's discriminator doesn't match the deployed program.

**Solution:** Update the discriminator in the script from the Anchor IDL:
1. Build program: `anchor build`
2. Check IDL: `target/idl/plp_prediction_market.json`
3. Find `migrate_market` instruction discriminator
4. Update `MIGRATE_MARKET_DISCRIMINATOR` in script

## FAQ

### Do I need to migrate immediately?
Yes, if you want users to be able to:
- Buy YES/NO shares
- Resolve the market
- Use any new program features

Without migration, the old market cannot interact with the upgraded program.

### Will migration affect user positions?
No! User Position PDAs are separate accounts and are not affected.

### Can I test migration on devnet first?
Yes! Deploy to devnet first and test with a devnet market before migrating mainnet markets.

### What if migration fails?
The migration is safe - if it fails, nothing changes. Common causes:
1. Insufficient payer balance
2. Network issues
3. Wrong market address

Check the error logs and try again.

## Support

If you encounter issues:
1. Check the program logs in the transaction explorer
2. Verify all accounts are correct
3. Ensure the program is deployed and upgrade authority matches
4. Check that the market address is valid

## Post-Migration

After successful migration:
1. ✅ Market can receive new votes (buy_yes/buy_no)
2. ✅ Market can be resolved (resolve_market)
3. ✅ All future SOL goes to/from the vault
4. ✅ Old Position PDAs still work for claims

**No frontend changes needed** - the backend automatically derives the vault PDA for all transactions.
