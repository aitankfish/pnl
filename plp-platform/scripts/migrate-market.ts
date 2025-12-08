/**
 * Market Migration Script
 *
 * Migrates an existing market to use the Market Vault PDA system.
 * This is required after upgrading the program to support vault-based SOL storage.
 *
 * Usage:
 *   npx tsx scripts/migrate-market.ts <MARKET_ADDRESS>
 *
 * Example:
 *   npx tsx scripts/migrate-market.ts 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'mainnet-beta';
const RPC_URL = NETWORK === 'mainnet-beta'
  ? process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com';

const PROGRAM_ID = new PublicKey('C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86');

// Migration instruction discriminator (first 8 bytes of sha256("global:migrate_market"))
const MIGRATE_MARKET_DISCRIMINATOR = Buffer.from([
  0xc9, 0x71, 0xb5, 0x78, 0xd9, 0x3c, 0x6d, 0xcb
]);

async function migrateMarket(marketAddress: string) {
  console.log('🔄 Market Migration Script');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Network: ${NETWORK}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log('');

  // Validate market address
  let marketPubkey: PublicKey;
  try {
    marketPubkey = new PublicKey(marketAddress);
  } catch (err) {
    console.error('❌ Invalid market address:', marketAddress);
    process.exit(1);
  }

  console.log(`Market: ${marketPubkey.toBase58()}`);

  // Connect to network
  const connection = new Connection(RPC_URL, 'confirmed');

  // Load payer keypair from environment or file
  let payer: Keypair;
  const keypairPath = process.env.PAYER_KEYPAIR_PATH || path.join(process.env.HOME!, '.config/solana/id.json');

  try {
    const keypairData = fs.readFileSync(keypairPath, 'utf-8');
    const secretKey = Uint8Array.from(JSON.parse(keypairData));
    payer = Keypair.fromSecretKey(secretKey);
    console.log(`Payer: ${payer.publicKey.toBase58()}`);
  } catch (err) {
    console.error('❌ Failed to load payer keypair from:', keypairPath);
    console.error('   Set PAYER_KEYPAIR_PATH environment variable or use default Solana CLI keypair');
    process.exit(1);
  }

  // Derive market vault PDA directly (seeds: [b"market_vault", market.key()])
  const [marketVaultPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('market_vault'),
      marketPubkey.toBytes()
    ],
    PROGRAM_ID
  );
  console.log(`Market Vault PDA: ${marketVaultPda.toBase58()}`);
  console.log('');

  // Check payer balance
  const payerBalance = await connection.getBalance(payer.publicKey);
  console.log(`Payer balance: ${(payerBalance / 1e9).toFixed(4)} SOL`);

  if (payerBalance < 0.01 * 1e9) {
    console.error('❌ Insufficient balance (need at least 0.01 SOL for rent + fees)');
    process.exit(1);
  }

  // Check if market exists
  const marketAccount = await connection.getAccountInfo(marketPubkey);
  if (!marketAccount) {
    console.error('❌ Market account not found on-chain');
    process.exit(1);
  }
  console.log(`✅ Market found (${marketAccount.data.length} bytes)`);

  // Check if vault already exists
  const vaultAccount = await connection.getAccountInfo(marketVaultPda);
  if (vaultAccount && vaultAccount.owner.toBase58() === PROGRAM_ID.toBase58()) {
    console.log('');
    console.log('⚠️  Market vault already exists!');
    console.log('   Migration may have already been completed.');
    console.log('   The instruction is idempotent, so it\'s safe to try anyway.');
    console.log('');
  }

  // Build migration instruction
  console.log('Building migration transaction...');

  // NOTE: Since we don't have the IDL yet, we'll construct the instruction manually
  // The instruction layout for migrate_market is:
  // - 8 bytes: discriminator (sha256("global:migrate_market").slice(0, 8))
  // - No additional data (no parameters)

  const instructionData = MIGRATE_MARKET_DISCRIMINATOR;

  const migrateInstruction = new TransactionInstruction({
    keys: [
      { pubkey: marketPubkey, isSigner: false, isWritable: true },           // market
      { pubkey: marketVaultPda, isSigner: false, isWritable: true },         // market_vault
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },         // payer
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(migrateInstruction);
  transaction.feePayer = payer.publicKey;

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Ready to migrate market');
  console.log('');
  console.log('This will:');
  console.log('  1. Create market_vault PDA (if needed)');
  console.log('  2. Transfer any SOL from market account to vault');
  console.log('  3. Enable buy_yes/buy_no/resolve_market with vault system');
  console.log('');
  console.log('Cost: ~0.001 SOL (rent for vault PDA + transaction fee)');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Sign and send transaction
  console.log('Signing transaction...');
  transaction.sign(payer);

  console.log('Sending transaction...');
  try {
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`Transaction sent: ${signature}`);
    console.log(`Explorer: https://solscan.io/tx/${signature}${NETWORK === 'devnet' ? '?cluster=devnet' : ''}`);
    console.log('');
    console.log('Confirming...');

    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      console.error('❌ Transaction failed:', confirmation.value.err);
      process.exit(1);
    }

    console.log('');
    console.log('✅ MIGRATION SUCCESSFUL!');
    console.log('');
    console.log('Market has been upgraded to use the vault system.');
    console.log('All future trades will use the market_vault PDA.');
    console.log('');

    // Show final balances
    const finalMarketAccount = await connection.getAccountInfo(marketPubkey);
    const finalVaultAccount = await connection.getAccountInfo(marketVaultPda);

    console.log('Final state:');
    console.log(`  Market balance: ${((finalMarketAccount?.lamports || 0) / 1e9).toFixed(6)} SOL`);
    console.log(`  Vault balance:  ${((finalVaultAccount?.lamports || 0) / 1e9).toFixed(6)} SOL`);

  } catch (err: any) {
    console.error('');
    console.error('❌ Transaction failed:');
    console.error(err.message || err);

    if (err.logs) {
      console.error('');
      console.error('Program logs:');
      err.logs.forEach((log: string) => console.error('  ', log));
    }

    process.exit(1);
  }
}

// Main execution
const marketAddress = process.argv[2];

if (!marketAddress) {
  console.error('Usage: npx tsx scripts/migrate-market.ts <MARKET_ADDRESS>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/migrate-market.ts 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  process.exit(1);
}

migrateMarket(marketAddress);
