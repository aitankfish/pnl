import { Connection, PublicKey } from '@solana/web3.js';

const MARKET_ADDRESS = '2hQwCVsrLQADJwie6FZe1jHmPVQ8URJuu4TpzLSNt3qX';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function main() {
  const connection = new Connection(RPC_URL);
  const marketPubkey = new PublicKey(MARKET_ADDRESS);

  const accountInfo = await connection.getAccountInfo(marketPubkey);
  if (!accountInfo) {
    console.log('Account not found');
    return;
  }

  console.log('Account size:', accountInfo.data.length, 'bytes');
  console.log('Owner:', accountInfo.owner.toBase58());

  const data = accountInfo.data;

  // Check discriminator (first 8 bytes)
  console.log('\n=== Discriminator (first 8 bytes) ===');
  console.log(data.subarray(0, 8).toString('hex'));

  // Check what we think should be treasury location (bytes 425-457 in data, or 433-465 including discriminator)
  console.log('\n=== Treasury should be at data offset 425-457 (absolute 433-465) ===');
  const treasuryBytes = data.subarray(433, 465);
  console.log('Hex:', treasuryBytes.toString('hex'));
  try {
    const treasury = new PublicKey(treasuryBytes);
    console.log('As Pubkey:', treasury.toBase58());
  } catch (e) {
    console.log('Not a valid pubkey');
  }

  // Check bump at data offset 457 (absolute 465)
  console.log('\n=== Bump should be at data offset 457 (absolute 465) ===');
  console.log('Value:', data[465]);

  // Check vesting fields at data offset 416-424 (absolute 424-432)
  console.log('\n=== Vesting fields should be at data offset 416-424 (absolute 424-432) ===');
  const vestingBytes = data.subarray(424, 433);
  console.log('Hex:', vestingBytes.toString('hex'));
  console.log('founder_excess_sol_allocated (u64):', vestingBytes.readBigUInt64LE(0).toString());
  console.log('founder_vesting_initialized (bool):', vestingBytes[8]);

  // Also check what's at the old treasury location (data offset 416, absolute 424)
  console.log('\n=== OLD treasury location at data offset 416-448 (absolute 424-456) ===');
  const oldTreasuryBytes = data.subarray(424, 456);
  console.log('Hex:', oldTreasuryBytes.toString('hex'));
  try {
    const oldTreasury = new PublicKey(oldTreasuryBytes.subarray(0, 32));
    console.log('As Pubkey:', oldTreasury.toBase58());
  } catch (e) {
    console.log('Not a valid pubkey');
  }
}

main().catch(console.error);
