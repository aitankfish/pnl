const { Connection, PublicKey, Transaction, TransactionInstruction, Keypair, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

// Configuration
const NETWORK = 'mainnet-beta';
const RPC_URL = process.env.HELIUS_RPC_MAINNET || 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86');

// Vault to drain
const VAULT_ADDRESS = '6pDtKeqGuHtRApESWwVRnyxkMeTvTMYw82J5M9TWCxsY';

// YOU NEED TO PROVIDE THESE:
const MARKET_ADDRESS = process.argv[2]; // First argument: market address
const FOUNDER_ADDRESS = process.argv[3]; // Second argument: founder address to receive SOL
const ADMIN_KEYPAIR_PATH = process.argv[4] || '/Users/bishwanathbastola/Downloads/FishTank/plp/deploy/payer-keypair.json'; // Third argument (optional): admin keypair path

async function drainVault() {
  if (!MARKET_ADDRESS || !FOUNDER_ADDRESS) {
    console.error('❌ Usage: node drain-stayease-vault.js <MARKET_ADDRESS> <FOUNDER_ADDRESS> [ADMIN_KEYPAIR_PATH]');
    console.error('');
    console.error('Example:');
    console.error('  node drain-stayease-vault.js FEtwfas8LAGPns7yHJCXv4ovybGhzn5N8FPJR8ui7bD7 7iyZKvd28ZcfVKUxeezwSkvdoQ9sN1D7pEGe42w8yTkZ');
    console.error('');
    console.error('To find the market address and founder:');
    console.error('  1. Go to the market page on PLP');
    console.error('  2. Market address is in the URL or page details');
    console.error('  3. Or check Helius explorer for the vault account owner');
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, 'confirmed');

  // Load admin keypair (must be treasury admin)
  console.log(`📂 Loading admin keypair from: ${ADMIN_KEYPAIR_PATH}`);
  const adminKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, 'utf-8')))
  );

  console.log(`\n🔧 Emergency Vault Drain`);
  console.log(`   Admin (caller): ${adminKeypair.publicKey.toBase58()}`);
  console.log(`   Market: ${MARKET_ADDRESS}`);
  console.log(`   Vault: ${VAULT_ADDRESS}`);
  console.log(`   Founder (receives SOL): ${FOUNDER_ADDRESS}`);

  const marketPubkey = new PublicKey(MARKET_ADDRESS);
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const founderPubkey = new PublicKey(FOUNDER_ADDRESS);

  // Derive Treasury PDA
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    PROGRAM_ID
  );

  // Verify vault PDA derivation
  const [expectedVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market_vault'), marketPubkey.toBuffer()],
    PROGRAM_ID
  );

  if (!expectedVaultPda.equals(vaultPubkey)) {
    console.error(`\n❌ ERROR: Vault PDA mismatch!`);
    console.error(`   Expected: ${expectedVaultPda.toBase58()}`);
    console.error(`   Provided: ${VAULT_ADDRESS}`);
    console.error(`\n   The vault address doesn't match this market address.`);
    console.error(`   Please verify the market address is correct.`);
    process.exit(1);
  }

  console.log(`\n✅ Vault PDA verified`);
  console.log(`   Treasury: ${treasuryPda.toBase58()}`);

  // Check vault balance
  const vaultBalance = await connection.getBalance(vaultPubkey);
  console.log(`\n💰 Current Vault Balance: ${vaultBalance / 1e9} SOL`);

  if (vaultBalance === 0) {
    console.log('ℹ️  Vault is empty, nothing to drain.');
    process.exit(0);
  }

  // Build instruction discriminator for emergency_drain_vault
  // sha256('global:emergency_drain_vault')[0..8]
  const discriminator = Buffer.from([40, 236, 0, 165, 252, 129, 108, 73]);

  // Build instruction (no additional data needed)
  const data = discriminator;

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: marketPubkey, isSigner: false, isWritable: true },
      { pubkey: vaultPubkey, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: false }, // Treasury for admin check
      { pubkey: founderPubkey, isSigner: false, isWritable: true }, // Founder receives, but doesn't sign
      { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true }, // Caller (must be treasury admin)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  // Build and send transaction
  const transaction = new Transaction().add(instruction);

  console.log('\n🚀 Sending emergency drain transaction...');
  const signature = await connection.sendTransaction(transaction, [adminKeypair], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log(`📝 Transaction sent: ${signature}`);
  console.log(`🔗 Explorer: https://solscan.io/tx/${signature}`);

  // Wait for confirmation
  console.log('\n⏳ Waiting for confirmation...');
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');

  if (confirmation.value.err) {
    console.error('\n❌ Transaction failed:', confirmation.value.err);
    process.exit(1);
  } else {
    console.log('\n✅ Vault drained successfully!');

    // Check new vault balance
    const newVaultBalance = await connection.getBalance(vaultPubkey);
    const drainedAmount = (vaultBalance - newVaultBalance) / 1e9;

    console.log(`\n💸 Drained: ${drainedAmount.toFixed(4)} SOL`);
    console.log(`📊 New Vault Balance: ${newVaultBalance / 1e9} SOL (rent-exempt only)`);
    console.log(`\n🎉 Funds sent to founder: ${FOUNDER_ADDRESS}`);
  }
}

drainVault().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
});
