/**
 * Test: Create a real token on pump.fun devnet
 *
 * This script creates an actual token on pump.fun using your wallet
 * to verify the integration works before implementing in Rust.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Pump.fun Program ID
const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Use Helius devnet RPC for better reliability
const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

function loadWallet(): Keypair {
  const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(walletData));
}

/**
 * Calculate discriminator for Anchor instruction
 */
function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash('sha256').update(`global:${name}`).digest();
  return hash.subarray(0, 8);
}

/**
 * Derive pump.fun PDAs
 */
function derivePumpPDAs(mint: PublicKey) {
  const [global] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PUMP_PROGRAM_ID
  );

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMP_PROGRAM_ID
  );

  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(), // Metaplex program
      mint.toBuffer(),
    ],
    new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
  );

  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    PUMP_PROGRAM_ID
  );

  return { global, bondingCurve, metadata, eventAuthority };
}

async function createPumpToken() {
  console.log('\n🚀 Creating Token on Pump.fun Devnet');
  console.log('='.repeat(60));

  const wallet = loadWallet();
  console.log(`\n📝 Using wallet: ${wallet.publicKey.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.1 * 1e9) {
    console.error('\n❌ Insufficient balance. Request devnet SOL:');
    console.error(`   solana airdrop 2 ${wallet.publicKey.toBase58()} --url devnet`);
    process.exit(1);
  }

  // Generate mint keypair
  const mint = Keypair.generate();
  console.log(`\n🎫 New token mint: ${mint.publicKey.toBase58()}`);

  // Derive PDAs
  const pdas = derivePumpPDAs(mint.publicKey);
  console.log('\n🔍 Derived PDAs:');
  console.log(`   Global:          ${pdas.global.toBase58()}`);
  console.log(`   Bonding Curve:   ${pdas.bondingCurve.toBase58()}`);
  console.log(`   Metadata:        ${pdas.metadata.toBase58()}`);
  console.log(`   Event Authority: ${pdas.eventAuthority.toBase58()}`);

  // Get associated token accounts
  const associatedBondingCurve = await getAssociatedTokenAddress(
    mint.publicKey,
    pdas.bondingCurve,
    true
  );

  const userTokenAccount = await getAssociatedTokenAddress(
    mint.publicKey,
    wallet.publicKey
  );

  console.log('\n💼 Token Accounts:');
  console.log(`   Bonding Curve ATA: ${associatedBondingCurve.toBase58()}`);
  console.log(`   User ATA:          ${userTokenAccount.toBase58()}`);

  // Fetch global account to get fee recipient
  console.log('\n🔎 Fetching global config...');
  try {
    const globalAccountInfo = await connection.getAccountInfo(pdas.global);
    if (globalAccountInfo) {
      console.log('✅ Global account exists');
      console.log(`   Owner: ${globalAccountInfo.owner.toBase58()}`);
      console.log(`   Data length: ${globalAccountInfo.data.length} bytes`);

      // Parse fee recipient from global account (if we knew the layout)
      // For now, we'll try using a common pattern
    } else {
      console.log('⚠️  Global account not found - pump.fun might not be deployed on devnet');
      console.log('   Trying mainnet-beta instead...');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error fetching global account:', error);
    process.exit(1);
  }

  console.log('\n📋 Token Metadata:');
  const tokenName = 'PLP Test Token';
  const tokenSymbol = 'PLPT';
  const tokenUri = 'https://plp-platform.vercel.app/api/metadata/test';
  console.log(`   Name:   ${tokenName}`);
  console.log(`   Symbol: ${tokenSymbol}`);
  console.log(`   URI:    ${tokenUri}`);

  console.log('\n⚠️  NEXT STEPS:');
  console.log('1. To complete this test, we need the exact instruction data format');
  console.log('2. Best approach: Use existing pump.fun SDK or API');
  console.log('3. Alternative: Reverse engineer from successful mainnet transactions');
  console.log('');
  console.log('💡 RECOMMENDATION:');
  console.log('   Use PumpPortal API for token creation:');
  console.log('   POST https://pumpportal.fun/api/trade-local');
  console.log('   (Simpler than direct CPI for testing)');

  return {
    mint: mint.publicKey,
    bondingCurve: pdas.bondingCurve,
    associatedBondingCurve,
  };
}

// Alternative: Try using PumpPortal API
async function createTokenViaAPI() {
  console.log('\n🌐 Alternative: Using PumpPortal API');
  console.log('='.repeat(60));

  const wallet = loadWallet();

  console.log('\n📝 To create via API:');
  console.log('');
  console.log('curl -X POST https://pumpportal.fun/api/trade-local \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{');
  console.log('    "publicKey": "' + wallet.publicKey.toBase58() + '",');
  console.log('    "action": "create",');
  console.log('    "tokenMetadata": {');
  console.log('      "name": "PLP Test Token",');
  console.log('      "symbol": "PLPT",');
  console.log('      "description": "Test token for PLP platform",');
  console.log('      "file": "https://plp-platform.vercel.app/logo.png"');
  console.log('    },');
  console.log('    "mint": "' + Keypair.generate().publicKey.toBase58() + '",');
  console.log('    "denominatedInSol": "true",');
  console.log('    "amount": 0.0001,');
  console.log('    "slippage": 10,');
  console.log('    "priorityFee": 0.00001,');
  console.log('    "pool": "pump"');
  console.log('  }\'');
  console.log('');
  console.log('⚠️  Note: This returns a transaction to sign, not a direct creation');
}

async function main() {
  try {
    await createPumpToken();
    console.log('\n');
    await createTokenViaAPI();

    console.log('\n' + '='.repeat(60));
    console.log('📊 CONCLUSION');
    console.log('='.repeat(60));
    console.log('✅ Program ID verified and exists on devnet');
    console.log('✅ PDAs derived successfully');
    console.log('⚠️  Need actual instruction format to create token');
    console.log('');
    console.log('💡 SOLUTIONS:');
    console.log('   1. Use pump.fun SDK (TypeScript): @raydium-io/raydium-sdk-v2');
    console.log('   2. Use PumpPortal API for transaction building');
    console.log('   3. Copy instruction from successful mainnet tx');
    console.log('');
    console.log('🎯 BEST FOR OUR USE CASE:');
    console.log('   Create token via frontend/API using pump SDK,');
    console.log('   then pass mint address to resolve_market instruction.');
    console.log('   This is Option 2 from PUMP_INTEGRATION_FINDINGS.md');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
