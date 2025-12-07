/**
 * Test Pump.fun Buy Transaction
 *
 * Tests buying tokens from an existing Pump.fun token to verify:
 * 1. PDA derivations are correct (volume accumulators)
 * 2. Transaction builds successfully
 * 3. Simulation passes
 *
 * Usage:
 *   WALLET_PRIVATE_KEY="base58_key" npx tsx scripts/test-pumpfun-buy.ts
 */

import { Connection, Keypair, Transaction, PublicKey } from '@solana/web3.js';
import {
  PumpSdk,
  OnlinePumpSdk,
  getBuyTokenAmountFromSolAmount,
  bondingCurvePda,
} from '@pump-fun/pump-sdk';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import BN from 'bn.js';

// Configuration
const NETWORK = 'mainnet-beta';
const TOKEN_MINT = '78gKMk8dK8PFGGnDvyQjA1JgcUmkt3scaJwfyvLYupNL'; // Your first launched token
const BUY_AMOUNT_SOL = 0.001; // Buy 0.001 SOL worth (very small test)

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_ENDPOINT = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

async function testPumpfunBuy() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 PUMP.FUN BUY TEST');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`Network: ${NETWORK.toUpperCase()}`);
  console.log(`RPC: ${RPC_ENDPOINT}`);
  console.log(`Token Mint: ${TOKEN_MINT}`);
  console.log(`Buy Amount: ${BUY_AMOUNT_SOL} SOL`);
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  try {
    // Step 1: Setup connection
    console.log('📡 Connecting to Solana...');
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const blockHeight = await connection.getBlockHeight();
    console.log(`✅ Connected! Block height: ${blockHeight}`);
    console.log('');

    // Step 2: Load wallet
    console.log('👛 Loading wallet...');

    // Use test wallet by default
    const fs = await import('fs');
    const path = await import('path');
    const testWalletPath = path.join(process.cwd(), 'scripts', 'test-wallet.json');

    let wallet: Keypair;
    if (process.env.WALLET_PRIVATE_KEY) {
      wallet = Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY));
    } else {
      // Use test wallet
      const testWalletData = JSON.parse(fs.readFileSync(testWalletPath, 'utf-8'));
      wallet = Keypair.fromSecretKey(new Uint8Array(testWalletData));
      console.log('   Using test wallet from scripts/test-wallet.json');
    }
    console.log(`✅ Wallet: ${wallet.publicKey.toBase58()}`);

    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`   Balance: ${(balance / 1e9).toFixed(4)} SOL`);
    console.log('');

    // Step 3: Initialize SDK
    console.log('🚀 Initializing Pump.fun SDK...');
    const onlineSdk = new OnlinePumpSdk(connection);
    const pumpSdk = new PumpSdk();
    console.log('✅ SDK initialized');
    console.log('');

    // Step 4: Get token info
    console.log('📊 Fetching token info...');
    const mintPubkey = new PublicKey(TOKEN_MINT);

    const global = await onlineSdk.fetchGlobal();
    console.log('✅ Global state fetched');

    const bondingCurve = await onlineSdk.fetchBondingCurve(mintPubkey);
    console.log('✅ Bonding curve fetched');
    console.log(`   Creator: ${bondingCurve.creator.toBase58()}`);
    console.log(`   Virtual SOL: ${bondingCurve.virtualSolReserves.toString()}`);
    console.log(`   Virtual Tokens: ${bondingCurve.virtualTokenReserves.toString()}`);
    console.log('');

    // Step 5: Calculate buy amount
    console.log('🧮 Calculating token amount...');
    const solAmount = new BN(BUY_AMOUNT_SOL * 1e9);
    const tokenAmount = getBuyTokenAmountFromSolAmount(bondingCurve, solAmount);
    console.log(`   SOL in: ${BUY_AMOUNT_SOL} SOL`);
    console.log(`   Tokens out: ${tokenAmount.toString()}`);
    console.log('');

    // Step 6: Build buy instruction
    console.log('🔧 Building buy instruction...');
    const bondingCurvePubkey = bondingCurvePda(mintPubkey);
    const bondingCurveAccountInfo = await connection.getAccountInfo(bondingCurvePubkey);

    const associatedUserPubkey = getAssociatedTokenAddressSync(
      mintPubkey,
      wallet.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    const associatedUserAccountInfo = await connection.getAccountInfo(associatedUserPubkey);

    const buyInstructions = await pumpSdk.buyInstructions({
      global,
      bondingCurveAccountInfo: bondingCurveAccountInfo!,
      bondingCurve,
      associatedUserAccountInfo,
      mint: mintPubkey,
      user: wallet.publicKey,
      amount: tokenAmount,
      solAmount,
      slippage: 0.05, // 5% slippage
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    console.log(`✅ Built ${buyInstructions.length} instruction(s)`);
    console.log('');

    // Step 7: Build transaction
    console.log('🔨 Building transaction...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    const transaction = new Transaction()
      .add(...buyInstructions);

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    console.log('✅ Transaction built');
    console.log('');

    // Step 8: Simulate
    console.log('🔍 Simulating transaction...');
    const simulation = await connection.simulateTransaction(transaction);

    if (simulation.value.err) {
      console.error('❌ Simulation failed!');
      console.error('Error:', simulation.value.err);
      if (simulation.value.logs) {
        console.error('');
        console.error('Logs:');
        simulation.value.logs.forEach(log => console.error(`  ${log}`));
      }
      process.exit(1);
    }

    console.log('✅ Simulation successful!');
    if (simulation.value.logs) {
      console.log('');
      console.log('Logs:');
      simulation.value.logs.forEach(log => console.log(`  ${log}`));
    }
    console.log('');

    // Success!
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 SUCCESS! BUY TRANSACTION SIMULATED');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('✅ PDAs are correctly derived!');
    console.log('✅ Transaction structure is valid!');
    console.log('✅ Ready to use in resolve_market CPI!');
    console.log('');
    console.log('Note: This was a simulation only. No tokens were purchased.');
    console.log('');
    console.log('═══════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('');
    console.error('═══════════════════════════════════════════════════');
    console.error('❌ ERROR OCCURRED');
    console.error('═══════════════════════════════════════════════════');
    console.error('');
    console.error('Error:', error.message);

    if (error.logs) {
      console.error('');
      console.error('Transaction Logs:');
      error.logs.forEach((log: string) => console.error(`  ${log}`));
    }

    console.error('');
    console.error('Stack:', error.stack);
    console.error('');
    console.error('═══════════════════════════════════════════════════');

    process.exit(1);
  }
}

// Run the test
testPumpfunBuy();
