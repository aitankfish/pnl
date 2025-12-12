import { Connection, PublicKey } from '@solana/web3.js';

const MARKET_ADDRESS = '2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX';
const PROGRAM_ID = 'C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function main() {
  const connection = new Connection(RPC_URL);
  const marketPubkey = new PublicKey(MARKET_ADDRESS);
  const programId = new PublicKey(PROGRAM_ID);

  // Derive market vault PDA
  const [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('market_vault'), marketPubkey.toBytes()],
    programId
  );

  console.log('Market Vault PDA:', vaultPDA.toBase58());
  console.log('Vault Bump:', vaultBump);

  // Check account info
  const vaultInfo = await connection.getAccountInfo(vaultPDA);

  if (!vaultInfo) {
    console.log('\n❌ Vault account does NOT exist!');
    return;
  }

  console.log('\n=== Vault Account Info ===');
  console.log('Owner:', vaultInfo.owner.toBase58());
  console.log('Balance:', vaultInfo.lamports / 1e9, 'SOL');
  console.log('Data Length:', vaultInfo.data.length, 'bytes');
  console.log('Executable:', vaultInfo.executable);
  console.log('Rent Epoch:', vaultInfo.rentEpoch);

  // Check if owned by system program
  const SYSTEM_PROGRAM = '11111111111111111111111111111111';
  const isSystemOwned = vaultInfo.owner.toBase58() === SYSTEM_PROGRAM;

  console.log('\n=== Ownership Check ===');
  console.log('Expected owner: System Program (11111111111111111111111111111111)');
  console.log('Actual owner:', vaultInfo.owner.toBase58());
  console.log('Is System Owned:', isSystemOwned ? '✅' : '❌');

  if (!isSystemOwned) {
    console.log('\n⚠️  ISSUE FOUND:');
    console.log('The vault is owned by:', vaultInfo.owner.toBase58());
    console.log('This is likely the PLP program itself.');
    console.log('The vault needs to be a System Account to pass the resolve_market check.');
  }
}

main().catch(console.error);
