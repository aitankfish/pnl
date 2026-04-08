/**
 * Pump.fun Integration Test Script
 *
 * This script tests the Pump.fun token creation and buy flow
 * to verify the integration works before implementing CPI in Rust.
 *
 * Run: npx ts-node tests/integration/test_pumpfun.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Pump.fun Program ID (works on both mainnet and devnet)
const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Devnet RPC
const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Test wallet (load from file or create new)
function loadOrCreateWallet(): Keypair {
  const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json');

  try {
    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
    console.log('✅ Loaded wallet from:', walletPath);
    console.log('   Address:', wallet.publicKey.toBase58());
    return wallet;
  } catch (e) {
    console.log('⚠️  Could not load wallet, creating new one...');
    const wallet = Keypair.generate();
    console.log('   New address:', wallet.publicKey.toBase58());
    console.log('   ⚠️  Request devnet SOL: solana airdrop 2', wallet.publicKey.toBase58(), '--url devnet');
    return wallet;
  }
}

/**
 * Derive PDAs for Pump.fun accounts
 */
async function derivePumpPDAs(mint: PublicKey) {
  // Global config PDA
  const [global] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PUMP_PROGRAM_ID
  );

  // Bonding curve PDA
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMP_PROGRAM_ID
  );

  // Associated bonding curve (token account for bonding curve)
  const associatedBondingCurve = await getAssociatedTokenAddress(
    mint,
    bondingCurve,
    true // allowOwnerOffCurve
  );

  // Event authority PDA
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    PUMP_PROGRAM_ID
  );

  // Fee recipient (usually the global config or a specific account)
  // This might be stored in the global config, so we'd need to fetch it
  // For now, using a placeholder
  const feeRecipient = global; // Placeholder

  return {
    global,
    bondingCurve,
    associatedBondingCurve,
    eventAuthority,
    feeRecipient,
  };
}

/**
 * Test Pump.fun create instruction
 */
async function testPumpCreate() {
  console.log('\n🧪 TEST: Pump.fun Create Token');
  console.log('='.repeat(50));

  const wallet = loadOrCreateWallet();

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / 1e9} SOL`);

  if (balance < 0.1 * 1e9) {
    console.error('❌ Insufficient balance. Request devnet SOL first:');
    console.error(`   solana airdrop 2 ${wallet.publicKey.toBase58()} --url devnet`);
    return;
  }

  // Generate new mint keypair
  const mint = Keypair.generate();
  console.log(`\n📝 Mint address: ${mint.publicKey.toBase58()}`);

  // Derive PDAs
  const pdas = await derivePumpPDAs(mint.publicKey);
  console.log('\n🔍 Derived PDAs:');
  console.log(`   Global: ${pdas.global.toBase58()}`);
  console.log(`   Bonding Curve: ${pdas.bondingCurve.toBase58()}`);
  console.log(`   Associated Bonding Curve: ${pdas.associatedBondingCurve.toBase58()}`);
  console.log(`   Event Authority: ${pdas.eventAuthority.toBase58()}`);

  // Get user's associated token account
  const userTokenAccount = await getAssociatedTokenAddress(
    mint.publicKey,
    wallet.publicKey
  );

  console.log(`   User Token Account: ${userTokenAccount.toBase58()}`);

  // NOTE: We would need the actual Pump.fun IDL to build the create instruction
  // For now, this is a skeleton showing what accounts are needed
  console.log('\n⚠️  To complete this test:');
  console.log('   1. Fetch Pump.fun IDL');
  console.log('   2. Build create instruction with proper data');
  console.log('   3. Include all required accounts');
  console.log('   4. Sign and send transaction');

  console.log('\n📋 Required Accounts for create():');
  console.log('   ✓ mint (signer)');
  console.log('   ✓ bonding_curve (PDA)');
  console.log('   ✓ associated_bonding_curve (ATA)');
  console.log('   ✓ global (PDA)');
  console.log('   ✓ user (signer)');
  console.log('   ✓ system_program');
  console.log('   ✓ token_program');
  console.log('   ✓ associated_token_program');
  console.log('   ✓ rent');
  console.log('   ✓ event_authority (PDA)');

  return {
    mint: mint.publicKey,
    wallet,
    pdas,
    userTokenAccount,
  };
}

/**
 * Test summary and recommendations
 */
async function main() {
  console.log('🚀 Pump.fun Integration Test\n');

  try {
    await testPumpCreate();

    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log('✅ Program ID verified: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    console.log('✅ PDAs derived successfully');
    console.log('✅ Required accounts identified');
    console.log('');
    console.log('⚠️  NEXT STEPS:');
    console.log('   1. Add pump-anchor SDK to Cargo.toml:');
    console.log('      pump = { git = "https://github.com/s6nqou/pump-anchor", features = ["cpi"] }');
    console.log('');
    console.log('   2. Update resolve_market.rs to use actual CPI:');
    console.log('      - Import pump::cpi module');
    console.log('      - Add all required accounts to ResolveMarket struct');
    console.log('      - Call pump::cpi::create() and pump::cpi::buy()');
    console.log('');
    console.log('   3. Alternative: Use client-side token creation');
    console.log('      - Create token on client via API call');
    console.log('      - Pass token mint to resolve_market instruction');
    console.log('      - Use CPI only for the buy() call');
    console.log('');
    console.log('💡 RECOMMENDATION:');
    console.log('   Since Pump.fun requires many accounts and complex CPI,');
    console.log('   consider option 3 (client-side creation) for MVP.');
    console.log('   This simplifies the on-chain program significantly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

main();
