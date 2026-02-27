const { Connection, PublicKey, Transaction, TransactionInstruction, Keypair, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

// Configuration
const NETWORK = 'mainnet-beta';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86');

// Market details
const MARKET_ADDRESS = 'FEtwfas8LAGPns7yHJCXv4ovybGhzn5N8FPJR8ui7bD7';
const FOUNDER_ADDRESS = '7iyZKvd28ZcfVKUxeezwSkvdoQ9sN1D7pEGe42w8yTkZ'; // From market.founder
const PAYER_KEYPAIR_PATH = '/Users/bishwanathbastola/Downloads/FishTank/plp/deploy/payer-keypair.json';

async function drainVault() {
  const connection = new Connection(RPC_URL, 'confirmed');

  // Load payer keypair (anyone can call this)
  const payerKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(PAYER_KEYPAIR_PATH, 'utf-8')))
  );

  console.log(`Caller (payer): ${payerKeypair.publicKey.toBase58()}`);
  console.log(`Founder (receives SOL): ${FOUNDER_ADDRESS}`);

  const marketPubkey = new PublicKey(MARKET_ADDRESS);
  const founderPubkey = new PublicKey(FOUNDER_ADDRESS);

  // Derive Treasury PDA
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    PROGRAM_ID
  );

  // Derive Market Vault PDA
  const [marketVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market_vault'), marketPubkey.toBuffer()],
    PROGRAM_ID
  );

  console.log(`Market: ${marketPubkey.toBase58()}`);
  console.log(`Treasury: ${treasuryPda.toBase58()}`);
  console.log(`Market Vault: ${marketVaultPda.toBase58()}`);

  // Check vault balance
  const vaultBalance = await connection.getBalance(marketVaultPda);
  console.log(`Vault Balance: ${vaultBalance / 1e9} SOL`);

  // Verify caller is treasury admin
  console.log('\nNote: Caller must be treasury admin to execute this instruction');

  // Build instruction discriminator for emergency_drain_vault
  // sha256('global:emergency_drain_vault')[0..8]
  const discriminator = Buffer.from([40, 236, 0, 165, 252, 129, 108, 73]);

  // Build instruction (no additional data needed)
  const data = discriminator;

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: marketPubkey, isSigner: false, isWritable: true },
      { pubkey: marketVaultPda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: false }, // Treasury for admin check
      { pubkey: founderPubkey, isSigner: false, isWritable: true }, // Founder receives, but doesn't sign
      { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true }, // Caller (must be treasury admin)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  // Build and send transaction
  const transaction = new Transaction().add(instruction);

  console.log('\nSending emergency drain transaction...');
  const signature = await connection.sendTransaction(transaction, [payerKeypair], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log(`Transaction sent: ${signature}`);
  console.log(`Explorer: https://solscan.io/tx/${signature}`);

  // Wait for confirmation
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');

  if (confirmation.value.err) {
    console.error('Transaction failed:', confirmation.value.err);
  } else {
    console.log('✅ Vault drained successfully!');

    // Check new vault balance
    const newVaultBalance = await connection.getBalance(marketVaultPda);
    console.log(`New Vault Balance: ${newVaultBalance / 1e9} SOL (rent-exempt only)`);
  }
}

drainVault().catch(console.error);
