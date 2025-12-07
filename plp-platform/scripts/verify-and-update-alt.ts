/**
 * Verify and Update Address Lookup Table (ALT)
 *
 * This script:
 * 1. Fetches the existing ALT on mainnet
 * 2. Lists all accounts currently in the ALT
 * 3. Checks if all required accounts are present
 * 4. Optionally adds missing accounts
 */

import { Connection, PublicKey, Keypair, AddressLookupTableProgram } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Existing ALT address
const ALT_ADDRESS = new PublicKey('hs9SCzyzTgqURSxLm4p3gTtLRUkmL54BWQrtYFn9JeS');

// RPC endpoint - using QuickNode mainnet
const RPC_URL = process.env.NEXT_PUBLIC_QUICKNODE_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';

// Required program accounts that should be in the ALT
const REQUIRED_ACCOUNTS = {
  // Core Solana programs
  'System Program': new PublicKey('11111111111111111111111111111111'),
  'Token Program': new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  'Token 2022 Program': TOKEN_2022_PROGRAM_ID,
  'Associated Token Program': ASSOCIATED_TOKEN_PROGRAM_ID,
  'Rent Sysvar': new PublicKey('SysvarRent111111111111111111111111111111111'),

  // Pump.fun programs (mainnet)
  'Pump Program': new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'),
  'Pump Global': new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'),
  'Pump Event Authority': new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'),
  'Pump Fee Recipient': new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM'),

  // Metaplex programs
  'Metadata Program': new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),

  // Your platform programs
  'PLP Program (Mainnet)': new PublicKey('Gnt1SpyMXSSxaauH88U1wPj7MnWo4qZgc17MUCCqBVhA'),
  'Treasury PDA': new PublicKey('BYiNs4v21nQS83i3deMpEWaZCKg6YGLhJQvf3Rgh97tY'),
};

async function main() {
  console.log('🔍 Verifying Address Lookup Table...');
  console.log(`ALT Address: ${ALT_ADDRESS.toBase58()}\n`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Fetch the ALT
  console.log('📡 Fetching ALT from blockchain...');
  const lookupTableAccount = await connection.getAddressLookupTable(ALT_ADDRESS);

  if (!lookupTableAccount.value) {
    console.error('❌ ALT not found!');
    console.error('The ALT address might be incorrect or not activated yet.');
    process.exit(1);
  }

  const alt = lookupTableAccount.value;
  console.log(`✅ ALT found!`);
  console.log(`   Authority: ${alt.state.authority?.toBase58() || 'None (frozen)'}`);
  console.log(`   Deactivation slot: ${alt.state.deactivationSlot}`);
  console.log(`   Last extended slot: ${alt.state.lastExtendedSlot}`);
  console.log(`   Total accounts: ${alt.state.addresses.length}\n`);

  // List current accounts
  console.log('📋 Current accounts in ALT:');
  console.log('─'.repeat(80));
  alt.state.addresses.forEach((address, index) => {
    // Try to identify the account
    let label = 'Unknown';
    for (const [name, pubkey] of Object.entries(REQUIRED_ACCOUNTS)) {
      if (address.equals(pubkey)) {
        label = name;
        break;
      }
    }
    console.log(`${String(index).padStart(3)}. ${address.toBase58()} - ${label}`);
  });
  console.log('─'.repeat(80));
  console.log('');

  // Check for missing required accounts
  const existingAccounts = new Set(alt.state.addresses.map(a => a.toBase58()));
  const missingAccounts: [string, PublicKey][] = [];

  console.log('🔍 Checking for required accounts...');
  for (const [name, pubkey] of Object.entries(REQUIRED_ACCOUNTS)) {
    const exists = existingAccounts.has(pubkey.toBase58());
    if (exists) {
      console.log(`   ✅ ${name}: ${pubkey.toBase58()}`);
    } else {
      console.log(`   ❌ ${name}: ${pubkey.toBase58()} (MISSING)`);
      missingAccounts.push([name, pubkey]);
    }
  }
  console.log('');

  // Summary
  if (missingAccounts.length === 0) {
    console.log('✅ All required accounts are present in the ALT!');
    console.log('✅ ALT is ready to use for native transactions.');
    process.exit(0);
  }

  // Report missing accounts
  console.log(`⚠️  Found ${missingAccounts.length} missing required account(s):`);
  missingAccounts.forEach(([name, pubkey]) => {
    console.log(`   - ${name}: ${pubkey.toBase58()}`);
  });
  console.log('');

  // Check if we can update (need authority)
  if (!alt.state.authority) {
    console.error('❌ Cannot update ALT: Authority is null (ALT is frozen)');
    console.error('You will need to create a new ALT or modify your transaction to work without these accounts.');
    process.exit(1);
  }

  console.log('💡 To add missing accounts, you need:');
  console.log('   1. The private key of the ALT authority');
  console.log(`   2. Authority address: ${alt.state.authority.toBase58()}`);
  console.log('');
  console.log('🔧 To extend the ALT with missing accounts, run:');
  console.log('   npm run extend-alt');
  console.log('');
  console.log('Or create a new ALT with all required accounts:');
  console.log('   npm run setup-alt');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
