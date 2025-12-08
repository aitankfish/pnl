/**
 * Anchor Program Client for PLP Prediction Market
 *
 * This module provides utilities for interacting with the deployed Solana program
 * using Anchor framework on the client-side.
 */

import { AnchorProvider, Program, web3, Idl } from '@coral-xyz/anchor';
import { PublicKey, Connection, Transaction, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { PROGRAM_ID, PDA_SEEDS, FEES, MIN_POOL_LAMPORTS, RPC_ENDPOINT } from '@/config/solana';
import idlJson from './idl/errors.json';

// Type for the IDL
type PlpPredictionMarket = typeof idlJson;

/**
 * Get dynamic program ID based on network
 *
 * @param network - Network to use (defaults to devnet)
 * @returns PublicKey of the program for the specified network
 */
export function getProgramIdForNetwork(network?: 'devnet' | 'mainnet-beta'): PublicKey {
  const targetNetwork = network || 'devnet';
  const PROGRAM_ID_DEVNET_STR = process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET || '2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G';
  const PROGRAM_ID_MAINNET_STR = process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET || '6kK2SVaj6yW7mAjTsw1rxMDNeby8A9ojv3UyhVPofmZL';
  const programIdString = targetNetwork === 'mainnet-beta' ? PROGRAM_ID_MAINNET_STR : PROGRAM_ID_DEVNET_STR;

  if (!programIdString) {
    throw new Error(`Program ID not configured for ${targetNetwork}`);
  }

  return new PublicKey(programIdString);
}

/**
 * Get Anchor program instance
 *
 * @param wallet - Wallet adapter (optional for read-only)
 * @param network - Network to use (devnet or mainnet-beta)
 * @returns Anchor Program instance
 */
export function getProgram(wallet?: any, network?: 'devnet' | 'mainnet-beta'): Program<PlpPredictionMarket> {
  // Get RPC endpoint based on network
  const targetNetwork = network || 'devnet';
  const RPC_MAINNET = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
  const RPC_DEVNET = process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';
  const rpcEndpoint = targetNetwork === 'mainnet-beta' ? RPC_MAINNET : RPC_DEVNET;

  const connection = new Connection(rpcEndpoint, 'confirmed');

  // Create a dummy wallet if none provided (for read-only operations)
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: Transaction) => tx,
    signAllTransactions: async (txs: Transaction[]) => txs,
  };

  const provider = new AnchorProvider(
    connection,
    wallet || dummyWallet,
    { commitment: 'confirmed' }
  );

  // Cast IDL to Idl type to avoid Anchor's strict type checking issues
  const idl = idlJson as Idl;

  return new Program(idl, provider) as Program<PlpPredictionMarket>;
}

/**
 * Derive Treasury PDA
 *
 * @param network - Network to use (defaults to devnet)
 * @returns Treasury PDA and bump
 */
export function getTreasuryPDA(network?: 'devnet' | 'mainnet-beta'): [PublicKey, number] {
  const programId = getProgramIdForNetwork(network);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.TREASURY)],
    programId
  );
}

/**
 * Derive Market PDA
 *
 * @param founderPubkey - Founder's public key
 * @param ipfsCid - IPFS CID of the project metadata
 * @param network - Network to use (defaults to devnet)
 * @returns Market PDA and bump
 */
export function getMarketPDA(founderPubkey: PublicKey, ipfsCid: string, network?: 'devnet' | 'mainnet-beta'): [PublicKey, number] {
  // Match on-chain program seeds: [b"market", founder.key(), hash(ipfs_cid.as_bytes())]
  // IPFS CIDs can be up to 59 bytes, but Solana PDA seeds have a 32-byte limit per seed
  // So we hash the IPFS CID using Solana's hash function to match the on-chain program
  // On-chain uses: anchor_lang::solana_program::hash::hash(ipfs_cid.as_bytes())
  const crypto = require('crypto');
  const solanaHash = crypto.createHash('sha256').update(ipfsCid, 'utf8').digest();
  const programId = getProgramIdForNetwork(network);

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PDA_SEEDS.MARKET),
      founderPubkey.toBytes(),
      solanaHash
    ],
    programId
  );
}

/**
 * Derive Market Vault PDA
 *
 * @param marketPubkey - Market PDA public key
 * @param network - Network to use (defaults to devnet)
 * @returns Market Vault PDA and bump
 */
export function getMarketVaultPDA(marketPubkey: PublicKey, network?: 'devnet' | 'mainnet-beta'): [PublicKey, number] {
  // Match on-chain program seeds: [b"market_vault", market.key()]
  const programId = getProgramIdForNetwork(network);

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('market_vault'),
      marketPubkey.toBytes()
    ],
    programId
  );
}

/**
 * Derive Position PDA
 *
 * @param marketPda - Market public key
 * @param userPubkey - User's public key
 * @param network - Network to use (defaults to devnet)
 * @returns Position PDA and bump
 */
export function getPositionPDA(
  marketPda: PublicKey,
  userPubkey: PublicKey,
  network?: 'devnet' | 'mainnet-beta'
): [PublicKey, number] {
  const programId = getProgramIdForNetwork(network);
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PDA_SEEDS.POSITION),
      marketPda.toBytes(),
      userPubkey.toBytes()
    ],
    programId
  );
}

/**
 * Build create market transaction (manually, without Anchor SDK)
 *
 * @param params - Market creation parameters
 * @returns Transaction instruction
 */
export async function buildCreateMarketTransaction(params: {
  founder: PublicKey;
  ipfsCid: string;
  targetPool: number; // in lamports (5/10/15 SOL)
  marketDuration: number; // in days
  metadataUri: string;
  wallet?: any;
  network?: 'devnet' | 'mainnet-beta';
}) {
  // Import crypto for hashing (Node.js only)
  const crypto = require('crypto');

  // Get RPC endpoint based on network
  const network = params.network || 'devnet';
  const RPC_MAINNET = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
  const RPC_DEVNET = process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';
  const rpcEndpoint = network === 'mainnet-beta' ? RPC_MAINNET : RPC_DEVNET;

  // Get program ID based on network parameter (not from static import)
  const PROGRAM_ID_DEVNET_STR = process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET || '2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G';
  const PROGRAM_ID_MAINNET_STR = process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET || '6kK2SVaj6yW7mAjTsw1rxMDNeby8A9ojv3UyhVPofmZL';
  const programIdString = network === 'mainnet-beta' ? PROGRAM_ID_MAINNET_STR : PROGRAM_ID_DEVNET_STR;

  if (!programIdString) {
    throw new Error(`Program ID not configured for ${network}`);
  }

  const programId = new PublicKey(programIdString);

  // Validate target pool (program now accepts any amount >= 0.5 SOL)
  if (params.targetPool < MIN_POOL_LAMPORTS) {
    throw new Error(
      `Invalid target pool. Must be at least ${MIN_POOL_LAMPORTS / 1e9} SOL`
    );
  }

  // Calculate expiry time (current time + market duration)
  const now = Math.floor(Date.now() / 1000);
  const expiryTime = now + (params.marketDuration * 24 * 60 * 60);

  // Derive PDAs
  const [treasuryPda] = getTreasuryPDA();
  const [marketPda] = getMarketPDA(params.founder, params.ipfsCid);

  // Calculate instruction discriminator for create_market
  // Anchor discriminator = first 8 bytes of SHA256("global:create_market")
  const discriminator = crypto
    .createHash('sha256')
    .update('global:create_market', 'utf8')
    .digest()
    .subarray(0, 8);

  // Serialize instruction data
  // Format: [discriminator(8 bytes), ipfs_cid(string), target_pool(u64), expiry_time(i64), metadata_uri(string)]
  const ipfsCidBytes = Buffer.from(params.ipfsCid, 'utf8');
  const metadataUriBytes = Buffer.from(params.metadataUri, 'utf8');

  // Create data buffer
  const data = Buffer.alloc(
    8 + // discriminator
    4 + ipfsCidBytes.length + // ipfs_cid (u32 length prefix + string)
    8 + // target_pool (u64)
    8 + // expiry_time (i64)
    4 + metadataUriBytes.length // metadata_uri (u32 length prefix + string)
  );

  let offset = 0;

  // Write discriminator
  discriminator.copy(data, offset);
  offset += 8;

  // Write ipfs_cid (string with u32 length prefix)
  data.writeUInt32LE(ipfsCidBytes.length, offset);
  offset += 4;
  ipfsCidBytes.copy(data, offset);
  offset += ipfsCidBytes.length;

  // Write target_pool (u64 little-endian)
  data.writeBigUInt64LE(BigInt(params.targetPool), offset);
  offset += 8;

  // Write expiry_time (i64 little-endian)
  data.writeBigInt64LE(BigInt(expiryTime), offset);
  offset += 8;

  // Write metadata_uri (string with u32 length prefix)
  data.writeUInt32LE(metadataUriBytes.length, offset);
  offset += 4;
  metadataUriBytes.copy(data, offset);

  // Create instruction
  const { TransactionInstruction: TxInstruction } = await import('@solana/web3.js');
  const instruction = new TxInstruction({
    keys: [
      { pubkey: marketPda, isSigner: false, isWritable: true },      // market
      { pubkey: treasuryPda, isSigner: false, isWritable: true },    // treasury
      { pubkey: params.founder, isSigner: true, isWritable: true },  // founder
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: programId,
    data,
  });

  // Create transaction with dynamic RPC endpoint
  const connection = new Connection(rpcEndpoint, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  const transaction = new Transaction({
    feePayer: params.founder,
    recentBlockhash: blockhash,
  }).add(instruction);

  return {
    transaction,
    marketPda: marketPda.toBase58(),
    treasuryPda: treasuryPda.toBase58(),
    expiryTime,
    creationFee: FEES.CREATION,
  };
}

/**
 * Build buy YES transaction (manual instruction building)
 *
 * @param params - Buy YES parameters
 * @returns Transaction instruction
 */
export async function buildBuyYesTransaction(params: {
  market: PublicKey;
  user: PublicKey;
  solAmount: number; // in lamports
  wallet?: any;
  network?: 'devnet' | 'mainnet-beta';
}) {
  const network = params.network || 'devnet';

  // Derive PDAs with network-specific program ID
  const [treasuryPda] = getTreasuryPDA(network);
  const [positionPda] = getPositionPDA(params.market, params.user, network);

  // Calculate buyYes discriminator: sha256("global:buy_yes")[0..8]
  const crypto = require('crypto');
  const discriminator = crypto
    .createHash('sha256')
    .update('global:buy_yes', 'utf8')
    .digest()
    .subarray(0, 8);

  // Serialize instruction data: [discriminator(8 bytes), sol_amount(u64)]
  const data = Buffer.alloc(8 + 8);

  // Write discriminator
  discriminator.copy(data, 0);

  // Write sol_amount (u64 little-endian)
  data.writeBigUInt64LE(BigInt(params.solAmount), 8);

  // Get dynamic program ID and RPC for the network
  const programId = getProgramIdForNetwork(network);
  const RPC_MAINNET = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
  const RPC_DEVNET = process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';
  const rpcEndpoint = network === 'mainnet-beta' ? RPC_MAINNET : RPC_DEVNET;

  // Create instruction
  const { TransactionInstruction } = await import('@solana/web3.js');
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: params.market, isSigner: false, isWritable: true },      // market
      { pubkey: positionPda, isSigner: false, isWritable: true },        // position
      { pubkey: treasuryPda, isSigner: false, isWritable: true },        // treasury (MUST be 3rd!)
      { pubkey: params.user, isSigner: true, isWritable: true },         // user (MUST be 4th!)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: programId,
    data,
  });

  // Create transaction with compute budget
  const connection = new Connection(rpcEndpoint, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  // Add compute budget instruction (1.4M CU for LMSR calculations)
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1_400_000,
  });

  const transaction = new Transaction({
    feePayer: params.user,
    recentBlockhash: blockhash,
  })
    .add(computeBudgetIx)  // Must be first!
    .add(instruction);

  return {
    transaction,
    positionPda: positionPda.toBase58(),
  };
}

/**
 * Build buy NO transaction (manual instruction building)
 *
 * @param params - Buy NO parameters
 * @returns Transaction instruction
 */
export async function buildBuyNoTransaction(params: {
  market: PublicKey;
  user: PublicKey;
  solAmount: number; // in lamports
  wallet?: any;
  network?: 'devnet' | 'mainnet-beta';
}) {
  const network = params.network || 'devnet';

  // Derive PDAs with network-specific program ID
  const [treasuryPda] = getTreasuryPDA(network);
  const [positionPda] = getPositionPDA(params.market, params.user, network);

  // Calculate buyNo discriminator: sha256("global:buy_no")[0..8]
  const crypto = require('crypto');
  const discriminator = crypto
    .createHash('sha256')
    .update('global:buy_no', 'utf8')
    .digest()
    .subarray(0, 8);

  // Serialize instruction data: [discriminator(8 bytes), sol_amount(u64)]
  const data = Buffer.alloc(8 + 8);

  // Write discriminator
  discriminator.copy(data, 0);

  // Write sol_amount (u64 little-endian)
  data.writeBigUInt64LE(BigInt(params.solAmount), 8);

  // Get dynamic program ID and RPC for the network
  const programId = getProgramIdForNetwork(network);
  const RPC_MAINNET = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
  const RPC_DEVNET = process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';
  const rpcEndpoint = network === 'mainnet-beta' ? RPC_MAINNET : RPC_DEVNET;

  // Create instruction
  const { TransactionInstruction } = await import('@solana/web3.js');
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: params.market, isSigner: false, isWritable: true },      // market
      { pubkey: positionPda, isSigner: false, isWritable: true },        // position
      { pubkey: treasuryPda, isSigner: false, isWritable: true },        // treasury (MUST be 3rd!)
      { pubkey: params.user, isSigner: true, isWritable: true },         // user (MUST be 4th!)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: programId,
    data,
  });

  // Create transaction with compute budget
  const connection = new Connection(rpcEndpoint, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  // Add compute budget instruction (1.4M CU for LMSR calculations)
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1_400_000,
  });

  const transaction = new Transaction({
    feePayer: params.user,
    recentBlockhash: blockhash,
  })
    .add(computeBudgetIx)  // Must be first!
    .add(instruction);

  return {
    transaction,
    positionPda: positionPda.toBase58(),
  };
}

/**
 * Build claim rewards transaction
 *
 * @param params - Claim rewards parameters
 * @returns Transaction instruction
 */
export async function buildClaimRewardsTransaction(params: {
  market: PublicKey;
  user: PublicKey;
  wallet?: any;
}) {
  const program = getProgram(params.wallet);

  // Derive position PDA
  const [positionPda] = getPositionPDA(params.market, params.user);

  // Build transaction
  const tx = await program.methods
    .claimRewards()
    .accounts({
      market: params.market,
      position: positionPda,
      user: params.user,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return {
    transaction: tx,
    positionPda: positionPda.toBase58(),
  };
}

/**
 * Build close position transaction
 *
 * @param params - Close position parameters
 * @returns Transaction instruction
 */
export async function buildClosePositionTransaction(params: {
  market: PublicKey;
  user: PublicKey;
  wallet?: any;
}) {
  const program = getProgram(params.wallet);

  // Derive position PDA
  const [positionPda] = getPositionPDA(params.market, params.user);

  // Build transaction
  const tx = await program.methods
    .closePosition()
    .accounts({
      market: params.market,
      position: positionPda,
      user: params.user,
    })
    .transaction();

  return {
    transaction: tx,
    positionPda: positionPda.toBase58(),
  };
}

/**
 * Build close market transaction (founder only)
 *
 * @param params - Close market parameters
 * @returns Transaction instruction
 */
export async function buildCloseMarketTransaction(params: {
  market: PublicKey;
  founder: PublicKey;
  wallet?: any;
}) {
  const program = getProgram(params.wallet);

  // Build transaction
  const tx = await program.methods
    .closeMarket()
    .accounts({
      market: params.market,
      founder: params.founder,
    })
    .transaction();

  return {
    transaction: tx,
  };
}

/**
 * Fetch market account data
 *
 * @param marketPda - Market PDA
 * @param wallet - Wallet (optional)
 * @returns Market account data
 */
export async function fetchMarketData(marketPda: PublicKey, wallet?: any) {
  const program = getProgram(wallet);
  return await program.account.market.fetch(marketPda);
}

/**
 * Fetch position account data
 *
 * @param positionPda - Position PDA
 * @param wallet - Wallet (optional)
 * @returns Position account data
 */
export async function fetchPositionData(positionPda: PublicKey, wallet?: any) {
  const program = getProgram(wallet);
  return await program.account.position.fetch(positionPda);
}

/**
 * Fetch treasury account data
 *
 * @param wallet - Wallet (optional)
 * @returns Treasury account data
 */
export async function fetchTreasuryData(wallet?: any) {
  const program = getProgram(wallet);
  const [treasuryPda] = getTreasuryPDA();
  return await program.account.treasury.fetch(treasuryPda);
}

/**
 * Calculate IPFS CID from metadata URI
 * This is a helper to extract CID from full IPFS URI
 *
 * @param metadataUri - Full IPFS URI (e.g., ipfs://QmAbc... or https://ipfs.io/ipfs/QmAbc...)
 * @returns IPFS CID
 */
export function extractIPFSCid(metadataUri: string): string {
  // Handle different IPFS URI formats
  if (metadataUri.startsWith('ipfs://')) {
    return metadataUri.replace('ipfs://', '');
  } else if (metadataUri.includes('/ipfs/')) {
    const parts = metadataUri.split('/ipfs/');
    return parts[1].split('/')[0]; // Get CID, ignore path
  } else if (metadataUri.startsWith('Qm') || metadataUri.startsWith('ba')) {
    // Already a CID
    return metadataUri;
  } else {
    throw new Error(`Invalid IPFS URI format: ${metadataUri}`);
  }
}

// Export constants for convenience
export {
  PROGRAM_ID,
  PDA_SEEDS,
  FEES,
  TARGET_POOL_OPTIONS,
  RPC_ENDPOINT,
} from '@/config/solana';
