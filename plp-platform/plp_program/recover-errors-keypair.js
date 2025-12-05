const fs = require('fs');
const { Keypair } = require('@solana/web3.js');
const bip39 = require('bip39');

const SEED_PHRASE = 'gather bubble horror bullet actress repair elder black improve flush clutch frown';

// Convert seed phrase to seed
const seed = bip39.mnemonicToSeedSync(SEED_PHRASE, '');

// DIRECT DERIVATION: Use first 32 bytes
const keypairSeed = seed.slice(0, 32);

// Create keypair
const keypair = Keypair.fromSeed(keypairSeed);

console.log('Recovered Address:', keypair.publicKey.toBase58());

// Save to file
const keypairArray = Array.from(keypair.secretKey);
fs.writeFileSync(
  'target/deploy/errors-keypair.json',
  JSON.stringify(keypairArray)
);

console.log('✅ Keypair saved to target/deploy/errors-keypair.json');
