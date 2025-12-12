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

  const data = accountInfo.data;

  console.log('=== Manual Decoding ===');
  let offset = 8; // Skip discriminator

  // founder: Pubkey (32 bytes)
  const founder = new PublicKey(data.subarray(offset, offset + 32));
  console.log('Founder (offset', offset, '):', founder.toBase58());
  offset += 32;

  // ipfs_cid: String
  const ipfsCidLen = data.readUInt32LE(offset);
  offset += 4;
  const ipfsCid = data.subarray(offset, offset + ipfsCidLen).toString('utf8');
  console.log('IPFS CID (len', ipfsCidLen, ', offset', offset - 4, '):', ipfsCid);
  offset += ipfsCidLen;

  console.log('Current offset after ipfs_cid:', offset);

  // Skip ahead and check treasury location
  const treasuryOffset = 257; // We know it's here
  const treasury = new PublicKey(data.subarray(treasuryOffset, treasuryOffset + 32));
  console.log('\nTreasury at offset', treasuryOffset, ':', treasury.toBase58());
  console.log('Bump at offset', treasuryOffset + 32, ':', data[treasuryOffset + 32]);

  // Calculate what we expected vs reality
  console.log('\nExpected treasury at data offset 425 (absolute 433), found at data offset 249 (absolute 257)');
  console.log('Difference:', 425 - 249, 'bytes');
}

main().catch(console.error);
