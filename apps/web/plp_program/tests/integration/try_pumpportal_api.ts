/**
 * Test PumpPortal API for token creation
 */

import axios from 'axios';
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

function loadWallet(): Keypair {
  const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(walletData));
}

async function tryPumpPortalAPI() {
  const wallet = loadWallet();
  const mint = Keypair.generate();

  console.log('\n🌐 Testing PumpPortal API');
  console.log('='.repeat(60));
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Mint:   ${mint.publicKey.toBase58()}`);

  const payload = {
    publicKey: wallet.publicKey.toBase58(),
    action: "create",
    tokenMetadata: {
      name: "PLP Test Token",
      symbol: "PLPT",
      description: "Test token for PLP platform on devnet",
      file: "https://plp-platform.vercel.app/logo.png"
    },
    mint: mint.publicKey.toBase58(),
    denominatedInSol: "true",
    amount: 0.0001,
    slippage: 10,
    priorityFee: 0.00001,
    pool: "pump"
  };

  console.log('\n📤 Sending request to PumpPortal...');
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post('https://pumpportal.fun/api/trade-local', payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    console.log('\n✅ Response received:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    if (error.response) {
      console.log('\n❌ API Error:');
      console.log(`Status: ${error.response.status}`);
      console.log(`Data:`, error.response.data);
    } else if (error.request) {
      console.log('\n❌ No response received');
      console.log(error.message);
    } else {
      console.log('\n❌ Request error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 NOTE:');
  console.log('   PumpPortal API might only support mainnet.');
  console.log('   For devnet testing, consider:');
  console.log('   1. Using pump.fun website directly');
  console.log('   2. Using testnetpump.fun if available');
  console.log('   3. Implementing Option 2 (client-side creation via SDK)');
}

tryPumpPortalAPI();
