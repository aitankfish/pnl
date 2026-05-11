/**
 * Anchor Program Client (shared)
 * Uses env abstraction instead of process.env
 */

import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { PublicKey, Connection, Transaction, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { getEnvConfig } from '../config/environment';
import { getProgramId, getRpcEndpoint, PDA_SEEDS, FEES, MIN_POOL_LAMPORTS, TARGET_POOL_OPTIONS } from '../config/solana';
import { createHash } from 'crypto';
import idlJson from '../idl/errors.json';

type PlpPredictionMarket = typeof idlJson;

export function getProgramIdForNetwork(network?: 'devnet' | 'mainnet-beta'): PublicKey {
  const config = getEnvConfig();
  const targetNetwork = network || config.SOLANA_NETWORK;
  const programIdString = targetNetwork === 'mainnet-beta'
    ? config.PLP_PROGRAM_ID_MAINNET
    : config.PLP_PROGRAM_ID_DEVNET;

  if (!programIdString) {
    throw new Error(`Program ID not configured for ${targetNetwork}`);
  }
  return new PublicKey(programIdString);
}

export function getProgram(wallet?: any, network?: 'devnet' | 'mainnet-beta'): Program<PlpPredictionMarket> {
  const config = getEnvConfig();
  const targetNetwork = network || config.SOLANA_NETWORK;
  const rpcEndpoint = targetNetwork === 'mainnet-beta'
    ? config.HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
    : config.HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';

  const connection = new Connection(rpcEndpoint, 'confirmed');
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: Transaction) => tx,
    signAllTransactions: async (txs: Transaction[]) => txs,
  };

  const provider = new AnchorProvider(connection, wallet || dummyWallet, { commitment: 'confirmed' });
  const idl = idlJson as Idl;
  return new Program(idl, provider) as Program<PlpPredictionMarket>;
}

export function getTreasuryPDA(network?: 'devnet' | 'mainnet-beta'): [PublicKey, number] {
  const programId = getProgramIdForNetwork(network);
  return PublicKey.findProgramAddressSync([Buffer.from(PDA_SEEDS.TREASURY)], programId);
}

export function getMarketPDA(founderPubkey: PublicKey, ipfsCid: string, network?: 'devnet' | 'mainnet-beta'): [PublicKey, number] {
  const solanaHash = createHash('sha256').update(ipfsCid, 'utf8').digest();
  const programId = getProgramIdForNetwork(network);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.MARKET), founderPubkey.toBytes(), solanaHash],
    programId
  );
}

export function getMarketVaultPDA(marketPubkey: PublicKey, network?: 'devnet' | 'mainnet-beta'): [PublicKey, number] {
  const programId = getProgramIdForNetwork(network);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market_vault'), marketPubkey.toBytes()],
    programId
  );
}

export function getPositionPDA(marketPda: PublicKey, userPubkey: PublicKey, network?: 'devnet' | 'mainnet-beta'): [PublicKey, number] {
  const programId = getProgramIdForNetwork(network);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.POSITION), marketPda.toBytes(), userPubkey.toBytes()],
    programId
  );
}

export async function buildCreateMarketTransaction(params: {
  founder: PublicKey;
  ipfsCid: string;
  targetPool: number;
  marketDuration: number;
  metadataUri: string;
  wallet?: any;
  network?: 'devnet' | 'mainnet-beta';
  // Server callers can pass a server-only RPC URL (built from HELIUS_API_KEY)
  // so they don't rely on NEXT_PUBLIC_HELIUS_MAINNET_RPC being correct in
  // every deploy environment. Client callers omit this and use env config.
  rpcEndpoint?: string;
}) {
  const config = getEnvConfig();
  const network = params.network || config.SOLANA_NETWORK;
  const rpcEndpoint = params.rpcEndpoint
    || (network === 'mainnet-beta'
      ? config.HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
      : config.HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com');

  const programId = getProgramIdForNetwork(network);

  if (params.targetPool < MIN_POOL_LAMPORTS) {
    throw new Error(`Invalid target pool. Must be at least ${MIN_POOL_LAMPORTS / 1e9} SOL`);
  }

  const now = Math.floor(Date.now() / 1000);
  const BUFFER_SECONDS = 5 * 60;
  const expiryTime = now + (params.marketDuration * 24 * 60 * 60) + BUFFER_SECONDS;

  const [treasuryPda] = getTreasuryPDA(network);
  const [marketPda] = getMarketPDA(params.founder, params.ipfsCid, network);
  const [marketVaultPda] = getMarketVaultPDA(marketPda, network);

  const discriminator = createHash('sha256').update('global:create_market', 'utf8').digest().subarray(0, 8);

  const ipfsCidBytes = Buffer.from(params.ipfsCid, 'utf8');
  const metadataUriBytes = Buffer.from(params.metadataUri, 'utf8');

  const data = Buffer.alloc(8 + 4 + ipfsCidBytes.length + 8 + 8 + 4 + metadataUriBytes.length);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeUInt32LE(ipfsCidBytes.length, offset); offset += 4;
  ipfsCidBytes.copy(data, offset); offset += ipfsCidBytes.length;
  data.writeBigUInt64LE(BigInt(params.targetPool), offset); offset += 8;
  data.writeBigInt64LE(BigInt(expiryTime), offset); offset += 8;
  data.writeUInt32LE(metadataUriBytes.length, offset); offset += 4;
  metadataUriBytes.copy(data, offset);

  const { TransactionInstruction: TxInstruction } = await import('@solana/web3.js');
  const instruction = new TxInstruction({
    keys: [
      { pubkey: marketPda, isSigner: false, isWritable: true },
      { pubkey: marketVaultPda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: params.founder, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  const connection = new Connection(rpcEndpoint, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction({ feePayer: params.founder, recentBlockhash: blockhash }).add(instruction);

  return { transaction, marketPda: marketPda.toBase58(), marketVaultPda: marketVaultPda.toBase58(), treasuryPda: treasuryPda.toBase58(), expiryTime, creationFee: FEES.CREATION };
}

export async function buildBuyYesTransaction(params: {
  market: PublicKey;
  user: PublicKey;
  solAmount: number;
  wallet?: any;
  network?: 'devnet' | 'mainnet-beta';
  // Server callers should pass a URL built from HELIUS_API_KEY so the public
  // NEXT_PUBLIC_HELIUS_MAINNET_RPC isn't on the hot path for blockhash fetches.
  rpcEndpoint?: string;
}) {
  const config = getEnvConfig();
  const network = params.network || config.SOLANA_NETWORK;
  const rpcEndpoint = params.rpcEndpoint
    || (network === 'mainnet-beta'
      ? config.HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
      : config.HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com');

  const [treasuryPda] = getTreasuryPDA(network);
  const [positionPda] = getPositionPDA(params.market, params.user, network);
  const [marketVaultPda] = getMarketVaultPDA(params.market, network);

  const discriminator = createHash('sha256').update('global:buy_yes', 'utf8').digest().subarray(0, 8);
  const data = Buffer.alloc(16);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(BigInt(params.solAmount), 8);

  const programId = getProgramIdForNetwork(network);
  const { TransactionInstruction } = await import('@solana/web3.js');
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: params.market, isSigner: false, isWritable: true },
      { pubkey: marketVaultPda, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  const connection = new Connection(rpcEndpoint, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
  const transaction = new Transaction({ feePayer: params.user, recentBlockhash: blockhash }).add(computeBudgetIx).add(instruction);

  return { transaction, positionPda: positionPda.toBase58() };
}

export async function buildBuyNoTransaction(params: {
  market: PublicKey;
  user: PublicKey;
  solAmount: number;
  wallet?: any;
  network?: 'devnet' | 'mainnet-beta';
  // Server callers should pass a URL built from HELIUS_API_KEY so the public
  // NEXT_PUBLIC_HELIUS_MAINNET_RPC isn't on the hot path for blockhash fetches.
  rpcEndpoint?: string;
}) {
  const config = getEnvConfig();
  const network = params.network || config.SOLANA_NETWORK;
  const rpcEndpoint = params.rpcEndpoint
    || (network === 'mainnet-beta'
      ? config.HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
      : config.HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com');

  const [treasuryPda] = getTreasuryPDA(network);
  const [positionPda] = getPositionPDA(params.market, params.user, network);
  const [marketVaultPda] = getMarketVaultPDA(params.market, network);

  const discriminator = createHash('sha256').update('global:buy_no', 'utf8').digest().subarray(0, 8);
  const data = Buffer.alloc(16);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(BigInt(params.solAmount), 8);

  const programId = getProgramIdForNetwork(network);
  const { TransactionInstruction } = await import('@solana/web3.js');
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: params.market, isSigner: false, isWritable: true },
      { pubkey: marketVaultPda, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  const connection = new Connection(rpcEndpoint, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
  const transaction = new Transaction({ feePayer: params.user, recentBlockhash: blockhash }).add(computeBudgetIx).add(instruction);

  return { transaction, positionPda: positionPda.toBase58() };
}

export async function buildClaimRewardsTransaction(params: {
  market: PublicKey;
  user: PublicKey;
  wallet?: any;
}) {
  const program = getProgram(params.wallet);
  const [positionPda] = getPositionPDA(params.market, params.user);

  const tx = await program.methods.claimRewards().accounts({
    market: params.market,
    position: positionPda,
    user: params.user,
    systemProgram: SystemProgram.programId,
  }).transaction();

  return { transaction: tx, positionPda: positionPda.toBase58() };
}

export async function buildClosePositionTransaction(params: {
  market: PublicKey;
  user: PublicKey;
  wallet?: any;
}) {
  const program = getProgram(params.wallet);
  const [positionPda] = getPositionPDA(params.market, params.user);

  const tx = await program.methods.closePosition().accounts({
    market: params.market,
    position: positionPda,
    user: params.user,
  }).transaction();

  return { transaction: tx, positionPda: positionPda.toBase58() };
}

export async function buildCloseMarketTransaction(params: {
  market: PublicKey;
  founder: PublicKey;
  wallet?: any;
}) {
  const program = getProgram(params.wallet);
  const tx = await program.methods.closeMarket().accounts({
    market: params.market,
    founder: params.founder,
  }).transaction();

  return { transaction: tx };
}

export async function fetchMarketData(marketPda: PublicKey, wallet?: any) {
  const program = getProgram(wallet);
  return await program.account.market.fetch(marketPda);
}

export async function fetchPositionData(positionPda: PublicKey, wallet?: any) {
  const program = getProgram(wallet);
  return await program.account.position.fetch(positionPda);
}

export async function fetchTreasuryData(wallet?: any) {
  const program = getProgram(wallet);
  const [treasuryPda] = getTreasuryPDA();
  return await program.account.treasury.fetch(treasuryPda);
}

export function extractIPFSCid(metadataUri: string): string {
  if (metadataUri.startsWith('ipfs://')) {
    return metadataUri.replace('ipfs://', '');
  } else if (metadataUri.includes('/ipfs/')) {
    const parts = metadataUri.split('/ipfs/');
    return parts[1].split('/')[0];
  } else if (metadataUri.startsWith('Qm') || metadataUri.startsWith('ba')) {
    return metadataUri;
  }
  throw new Error(`Invalid IPFS URI format: ${metadataUri}`);
}

export { PDA_SEEDS, FEES, TARGET_POOL_OPTIONS } from '../config/solana';
