import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import crypto from 'crypto';

const MARKET_ADDRESS = '2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX';
const PROGRAM_ID = 'C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function main() {
  console.log('🔧 Migrating market to v2 (raw transaction)...');
  console.log('Market:', MARKET_ADDRESS);

  // Load payer keypair
  const payerKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')))
  );

  console.log('Payer:', payerKeypair.publicKey.toBase58());

  const connection = new Connection(RPC_URL, 'confirmed');
  const marketPubkey = new PublicKey(MARKET_ADDRESS);
  const programId = new PublicKey(PROGRAM_ID);

  // Calculate discriminator for migrate_market_v2
  const discriminator = crypto
    .createHash('sha256')
    .update('global:migrate_market_v2', 'utf8')
    .digest()
    .subarray(0, 8);

  console.log('Instruction discriminator:', discriminator.toString('hex'));

  // Build instruction
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: marketPubkey, isSigner: false, isWritable: true },  // market
      { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true },  // payer
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // system_program
    ],
    programId,
    data: discriminator,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = payerKeypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  try {
    console.log('📤 Sending transaction...');
    const sig = await sendAndConfirmTransaction(connection, tx, [payerKeypair], {
      commitment: 'confirmed',
    });

    console.log('✅ Migration successful!');
    console.log('Transaction:', sig);
    console.log('View: https://solscan.io/tx/' + sig);

    // Verify new size
    console.log('\n⏳ Waiting 5s for confirmation...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const marketAccount = await connection.getAccountInfo(marketPubkey);
    console.log('\n📊 Market account info:');
    console.log('Size:', marketAccount?.data.length, 'bytes');
    console.log('Expected: 480 bytes');
    console.log('Match:', marketAccount?.data.length === 480 ? '✅' : '❌');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

main().catch(console.error);
