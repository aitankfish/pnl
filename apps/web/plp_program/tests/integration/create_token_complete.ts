/**
 * Complete token creation flow using PumpPortal API
 */

import axios from 'axios';
import {
  Connection,
  Keypair,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';

const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

function loadWallet(): Keypair {
  const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(walletData));
}

async function createTokenComplete() {
  const wallet = loadWallet();
  const mint = Keypair.generate();

  console.log('\n🚀 Creating PLP Test Token on Mainnet');
  console.log('='.repeat(60));
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Mint:   ${mint.publicKey.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL`);

  const payload = {
    publicKey: wallet.publicKey.toBase58(),
    action: "create",
    tokenMetadata: {
      name: "PLP Test Token",
      symbol: "PLPT",
      description: "Test token for PLP platform",
      file: "https://plp-platform.vercel.app/logo.png"
    },
    mint: mint.publicKey.toBase58(),
    denominatedInSol: "true",
    amount: 0.0001, // Minimal initial buy
    slippage: 10,
    priorityFee: 0.00001,
    pool: "pump"
  };

  console.log('\n📤 Step 1: Request transaction from PumpPortal API...');

  try {
    const response = await axios.post('https://pumpportal.fun/api/trade-local', payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      responseType: 'arraybuffer', // Get raw bytes
    });

    console.log('✅ Transaction received from API');

    // Deserialize the transaction
    const txBuffer = Buffer.from(response.data);
    console.log(`   Transaction size: ${txBuffer.length} bytes`);

    console.log('\n📝 Step 2: Deserializing transaction...');
    const transaction = VersionedTransaction.deserialize(txBuffer);
    console.log('✅ Transaction deserialized');

    console.log('\n✍️  Step 3: Signing transaction with wallet...');
    // Sign with both wallet and mint keypairs
    transaction.sign([wallet, mint]);
    console.log('✅ Transaction signed');

    console.log('\n📤 Step 4: Sending transaction to Solana...');
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log(`✅ Transaction sent: ${signature}`);
    console.log(`   View on Solscan: https://solscan.io/tx/${signature}`);

    console.log('\n⏳ Step 5: Confirming transaction...');
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('✅ Transaction confirmed!');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TOKEN CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`Token Mint: ${mint.publicKey.toBase58()}`);
    console.log(`View on Pump.fun: https://pump.fun/${mint.publicKey.toBase58()}`);
    console.log(`View on Solscan: https://solscan.io/token/${mint.publicKey.toBase58()}`);
    console.log('');
    console.log('✅ This confirms pump.fun integration works!');
    console.log('✅ We can use this same flow in our platform');

    return {
      mint: mint.publicKey.toBase58(),
      signature,
    };

  } catch (error: any) {
    if (error.response) {
      console.log('\n❌ API Error:');
      console.log(`Status: ${error.response.status}`);
      console.log(`Data:`, error.response.data);
    } else if (error.code === 'ECONNABORTED') {
      console.log('\n❌ Request timeout');
    } else {
      console.log('\n❌ Error:', error.message);
      if (error.logs) {
        console.log('Transaction logs:', error.logs);
      }
    }
    throw error;
  }
}

createTokenComplete().catch((err) => {
  console.error('\n❌ Failed:', err.message);
  process.exit(1);
});
