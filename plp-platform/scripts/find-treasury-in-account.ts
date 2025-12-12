import { Connection, PublicKey } from '@solana/web3.js';

const MARKET_ADDRESS = '2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX';
const PROGRAM_ID = 'C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function main() {
  const connection = new Connection(RPC_URL);
  const marketPubkey = new PublicKey(MARKET_ADDRESS);
  const programId = new PublicKey(PROGRAM_ID);

  // Calculate expected treasury PDA
  const [treasuryPDA, treasuryBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    programId
  );

  console.log('Expected treasury PDA:', treasuryPDA.toBase58());
  console.log('Expected treasury bump:', treasuryBump);

  const accountInfo = await connection.getAccountInfo(marketPubkey);
  if (!accountInfo) {
    console.log('Account not found');
    return;
  }

  console.log('\n=== Searching for treasury address in account data ===');
  const data = accountInfo.data;
  const treasuryBytes = treasuryPDA.toBytes();

  // Search for treasury bytes in the entire account
  for (let i = 0; i < data.length - 32; i++) {
    let match = true;
    for (let j = 0; j < 32; j++) {
      if (data[i + j] !== treasuryBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log('Found treasury at byte offset:', i);
      console.log('Data index (excluding discriminator):', i - 8);
    }
  }

  // Also print some key offsets to understand the structure
  console.log('\n=== Dumping key sections ===');
  console.log('Bytes 400-450:');
  console.log(data.subarray(400, 450).toString('hex'));

  console.log('\nBytes 450-480:');
  console.log(data.subarray(450, 480).toString('hex'));
}

main().catch(console.error);
