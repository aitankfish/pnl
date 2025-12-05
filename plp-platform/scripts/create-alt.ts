/**
 * Create Address Lookup Table for PLP Platform
 *
 * This reduces transaction size by storing frequently-used program accounts
 * in a lookup table. Each account reference goes from 32 bytes to 1 byte.
 *
 * Run: npx ts-node scripts/create-alt.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableProgram,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Network configuration
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Load payer keypair
const payerKeypairPath = path.join(__dirname, '../plp_program/target/deploy/payer-keypair.json');
const payerKeypairData = JSON.parse(fs.readFileSync(payerKeypairPath, 'utf-8'));
const payer = Keypair.fromSecretKey(Uint8Array.from(payerKeypairData));

// Frequently-used program accounts to add to the lookup table
const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');

const PROGRAM_ACCOUNTS = [
  SystemProgram.programId,           // 11111111111111111111111111111111
  TOKEN_2022_PROGRAM_ID,             // TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
  ASSOCIATED_TOKEN_PROGRAM_ID,       // ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
  SYSVAR_RENT_PUBKEY,                // SysvarRent111111111111111111111111111111111
  PUMP_PROGRAM_ID,                   // 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
  FEE_PROGRAM_ID,                    // pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ
];

async function main() {
  console.log('🚀 Creating Address Lookup Table for PLP Platform');
  console.log('================================================\n');

  console.log('Payer:', payer.publicKey.toBase58());
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL\n');

  if (balance < 0.05 * 1e9) {
    console.error('❌ Insufficient balance. Need at least 0.05 SOL for ALT creation.');
    process.exit(1);
  }

  // Step 1: Create the lookup table
  console.log('📋 Step 1: Creating Address Lookup Table...');
  const slot = await connection.getSlot();
  console.log('Current slot:', slot);

  const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });

  console.log('Lookup table address:', lookupTableAddress.toBase58());

  // Build and send create transaction
  const { blockhash } = await connection.getLatestBlockhash();
  const createMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [lookupTableInst],
  }).compileToV0Message();

  const createTx = new VersionedTransaction(createMessage);
  createTx.sign([payer]);

  console.log('Sending create transaction...');
  const createSig = await connection.sendTransaction(createTx);
  console.log('Create transaction signature:', createSig);

  // Wait for confirmation
  await connection.confirmTransaction(createSig, 'confirmed');
  console.log('✅ Lookup table created!\n');

  // Step 2: Extend the lookup table with program accounts
  console.log('📋 Step 2: Adding program accounts to lookup table...');
  console.log('Accounts to add:');
  PROGRAM_ACCOUNTS.forEach((account, i) => {
    console.log(`  ${i + 1}. ${account.toBase58()}`);
  });
  console.log();

  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: PROGRAM_ACCOUNTS,
  });

  const { blockhash: extendBlockhash } = await connection.getLatestBlockhash();
  const extendMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: extendBlockhash,
    instructions: [extendInstruction],
  }).compileToV0Message();

  const extendTx = new VersionedTransaction(extendMessage);
  extendTx.sign([payer]);

  console.log('Sending extend transaction...');
  const extendSig = await connection.sendTransaction(extendTx);
  console.log('Extend transaction signature:', extendSig);

  // Wait for confirmation
  await connection.confirmTransaction(extendSig, 'confirmed');
  console.log('✅ Program accounts added to lookup table!\n');

  // Step 3: Wait for activation (ALT needs 1 slot to activate)
  console.log('⏳ Waiting for lookup table to activate (1 slot)...');
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait ~1 slot

  // Verify the lookup table
  const lookupTableAccount = await connection.getAddressLookupTable(lookupTableAddress);
  if (lookupTableAccount.value) {
    console.log('\n✅ Lookup table verified!');
    console.log('   State:', lookupTableAccount.value.state);
    console.log('   Addresses:', lookupTableAccount.value.state.addresses.length);
    console.log();
    console.log('Lookup table contents:');
    lookupTableAccount.value.state.addresses.forEach((addr, i) => {
      console.log(`  [${i}] ${addr.toBase58()}`);
    });
  }

  console.log('\n================================================');
  console.log('✅ SUCCESS! Address Lookup Table created');
  console.log('================================================');
  console.log('\n📋 Add this to your .env or config:');
  console.log(`ALT_ADDRESS="${lookupTableAddress.toBase58()}"`);
  console.log('\n💾 Savings per transaction: ~186 bytes');
  console.log('   (6 accounts × 31 bytes saved per account)');
  console.log('\n🔗 Explorer:');
  console.log(`   https://explorer.solana.com/address/${lookupTableAddress.toBase58()}`);
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
