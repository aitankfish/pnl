/**
 * Pump.fun Integration Utilities
 *
 * Helpers for creating tokens on pump.fun and building atomic transactions
 * to prevent bot frontrunning.
 */

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import axios from 'axios';

// Pump.fun Program ID (mainnet and devnet)
export const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Metaplex Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/**
 * Derive pump.fun PDAs for a given mint
 */
export function derivePumpPDAs(mint: PublicKey) {
  // Global config PDA
  const [global] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PUMP_PROGRAM_ID
  );

  // Bonding curve PDA
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMP_PROGRAM_ID
  );

  // Metadata PDA (Metaplex)
  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  // Event authority PDA
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    PUMP_PROGRAM_ID
  );

  return {
    global,
    bondingCurve,
    metadata,
    eventAuthority,
  };
}

/**
 * Get pump.fun create instruction via PumpPortal API
 *
 * @param params Token creation parameters
 * @returns Serialized create instruction transaction
 */
export async function getPumpCreateInstruction(params: {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  mint: PublicKey;
  creator: PublicKey;
}): Promise<VersionedTransaction> {
  const payload = {
    publicKey: params.creator.toBase58(),
    action: "create",
    tokenMetadata: {
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      file: params.imageUrl,
    },
    mint: params.mint.toBase58(),
    denominatedInSol: "true",
    amount: 0, // Don't buy yet, just create
    slippage: 10,
    priorityFee: 0.00001,
    pool: "pump"
  };

  console.log('📤 Requesting pump.fun create transaction from PumpPortal API...');

  const response = await axios.post('https://pumpportal.fun/api/trade-local', payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
    responseType: 'arraybuffer',
  });

  console.log('✅ Received transaction from PumpPortal');

  // Deserialize the transaction
  const txBuffer = Buffer.from(response.data);
  const transaction = VersionedTransaction.deserialize(txBuffer);

  return transaction;
}

/**
 * Derive all accounts needed for resolve_market with pump.fun integration
 */
export async function getResolveMarketWithTokenAccounts(params: {
  marketAddress: PublicKey;
  tokenMint: PublicKey;
  treasuryAddress: PublicKey;
  caller: PublicKey;
  marketBump: number;
}) {
  const { marketAddress, tokenMint, caller } = params;

  // Derive pump.fun PDAs
  const pumpPDAs = derivePumpPDAs(tokenMint);

  // Get market's token account (ATA)
  const marketTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    marketAddress,
    true // allowOwnerOffCurve
  );

  // Get bonding curve's token account (ATA)
  const bondingCurveTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    pumpPDAs.bondingCurve,
    true
  );

  return {
    market: marketAddress,
    treasury: params.treasuryAddress,
    tokenMint,
    marketTokenAccount,
    pumpGlobal: pumpPDAs.global,
    bondingCurve: pumpPDAs.bondingCurve,
    bondingCurveTokenAccount,
    pumpFeeRecipient: pumpPDAs.global, // Usually global is also fee recipient
    pumpEventAuthority: pumpPDAs.eventAuthority,
    pumpProgram: PUMP_PROGRAM_ID,
    caller,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  };
}

/**
 * Build atomic transaction: Create token + Resolve market
 * This prevents bots from frontrunning the token creation
 */
export async function buildAtomicTokenLaunchTransaction(params: {
  createTx: VersionedTransaction;
  resolveInstruction: TransactionInstruction;
  recentBlockhash: string;
  feePayer: PublicKey;
}): Promise<VersionedTransaction> {
  const { createTx, resolveInstruction, recentBlockhash, feePayer } = params;

  console.log('🔧 Building atomic transaction (create + resolve)...');

  // Extract instructions from create transaction
  const createMessage = createTx.message;
  const createInstructions = createMessage.compiledInstructions;

  // Build new message with both create and resolve instructions
  const messageV0 = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash,
    instructions: [
      // First, create the token
      ...createInstructions.map((ix) => ({
        programId: createMessage.staticAccountKeys[ix.programIdIndex],
        keys: ix.accountKeyIndexes.map((index) => ({
          pubkey: createMessage.staticAccountKeys[index],
          isSigner: createMessage.header.numRequiredSignatures > index,
          isWritable: index < createMessage.header.numReadonlySignedAccounts +
                      createMessage.header.numReadonlyUnsignedAccounts,
        })),
        data: Buffer.from(ix.data),
      })),
      // Then, immediately resolve with buy
      resolveInstruction,
    ],
  }).compileToV0Message();

  const atomicTx = new VersionedTransaction(messageV0);

  console.log('✅ Atomic transaction built');
  console.log(`   Instructions: ${atomicTx.message.compiledInstructions.length}`);

  return atomicTx;
}
