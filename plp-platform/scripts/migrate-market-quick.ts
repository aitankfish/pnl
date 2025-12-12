import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import fs from 'fs';
import idl from '../src/lib/idl/errors.json';

const MARKET_ADDRESS = '2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX';
const PROGRAM_ID = 'C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function main() {
  console.log('🔧 Migrating market to v2...');
  console.log('Market:', MARKET_ADDRESS);

  // Load payer keypair
  const payerKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')))
  );

  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(payerKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl as any, provider);

  const marketPubkey = new PublicKey(MARKET_ADDRESS);

  try {
    // Call migrate_market_v2
    const tx = await program.methods
      .migrateMarketV2()
      .accounts({
        market: marketPubkey,
        payer: payerKeypair.publicKey,
        systemProgram: PublicKey.default,
      })
      .rpc();

    console.log('✅ Migration successful!');
    console.log('Transaction:', tx);
    console.log('View: https://solscan.io/tx/' + tx);

    // Verify new size
    const marketAccount = await connection.getAccountInfo(marketPubkey);
    console.log('\n📊 Market account info:');
    console.log('Size:', marketAccount?.data.length, 'bytes');
    console.log('Expected: 480 bytes');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

main().catch(console.error);
