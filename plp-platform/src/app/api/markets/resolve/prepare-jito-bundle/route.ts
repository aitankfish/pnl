/**
 * API endpoint for preparing market resolution with Jito bundling
 *
 * Returns TWO separate transactions that will be bundled atomically via Jito:
 * 1. Create token transaction (signed by founder + mint keypair)
 * 2. Resolve market transaction (signed by caller, includes Jito tip)
 *
 * This approach bypasses the 1232 byte transaction limit while maintaining atomicity.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { getTreasuryPDA, getProgramIdForNetwork } from '@/lib/anchor-program';
import { derivePumpPDAs, PUMP_PROGRAM_ID } from '@/lib/pumpfun';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';
import { createJitoTipInstruction, MINIMUM_JITO_TIP } from '@/lib/jito';

// Pump.fun fee program address (from official IDL)
const PUMP_FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');

// Pump.fun fee recipient address (hardcoded)
const PUMP_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');

const logger = createClientLogger();

// Address Lookup Table (mainnet) - contains frequently-used program accounts
const ALT_ADDRESS = new PublicKey('hs9SCzyzTgqURSxLm4p3gTtLRUkmL54BWQrtYFn9JeS');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      marketAddress,
      tokenMint,
      callerWallet,
      founder Wallet,
      createInstructionData, // Pump.fun createV2 instruction (from frontend)
      creator,
      network,
    } = body;

    // Validate inputs
    if (!marketAddress || !tokenMint || !callerWallet || !founderWallet || !createInstructionData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, tokenMint, callerWallet, founderWallet, createInstructionData',
        },
        { status: 400 }
      );
    }

    const creatorAddress = creator || callerWallet;

    logger.info('🎯 Preparing Jito bundle for token launch + resolution', {
      marketAddress,
      tokenMint,
      callerWallet,
      founderWallet,
      creator: creatorAddress,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const callerPubkey = new PublicKey(callerWallet);
    const founderPubkey = new PublicKey(founderWallet);
    const creatorPubkey = new PublicKey(creatorAddress);

    // Get network-specific program ID
    const targetNetwork = (network as 'devnet' | 'mainnet-beta') || 'devnet';
    const programId = getProgramIdForNetwork(targetNetwork);

    // Derive Treasury PDA
    const [treasuryPda] = getTreasuryPDA(targetNetwork);

    // Get connection
    const connection = await getSolanaConnection(network);

    // Derive pump.fun PDAs
    const pumpPDAs = derivePumpPDAs(tokenMintPubkey);

    // Get market's token account (ATA) - using Token2022
    const marketTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      marketPubkey,
      true, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID
    );

    // Get bonding curve's token account (ATA)
    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      pumpPDAs.bondingCurve,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    // Derive additional Pump.fun PDAs
    const [creatorVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('creator-vault'), creatorPubkey.toBuffer()],
      PUMP_PROGRAM_ID
    );

    const [globalVolumeAccumulator] = PublicKey.findProgramAddressSync(
      [Buffer.from('global-volume-accumulator')],
      PUMP_PROGRAM_ID
    );

    const [userVolumeAccumulator] = PublicKey.findProgramAddressSync(
      [Buffer.from('user-volume-accumulator'), marketPubkey.toBuffer()],
      PUMP_PROGRAM_ID
    );

    const [feeConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee-config')],
      PUMP_FEE_PROGRAM_ID
    );

    logger.info('📋 All accounts derived for Jito bundle');

    // ═══════════════════════════════════════════════════════════════
    // TRANSACTION 1: CREATE TOKEN (Pump.fun createV2)
    // ═══════════════════════════════════════════════════════════════

    const { blockhash: blockhash1, lastValidBlockHeight: lastValidBlockHeight1 } =
      await connection.getLatestBlockhash('confirmed');

    // Compute budget for createV2 (500k CU should be enough)
    const computeBudget1 = ComputeBudgetProgram.setComputeUnitLimit({
      units: 500_000,
    });

    // Deserialize the createV2 instruction data from frontend
    const createIx = JSON.parse(createInstructionData);

    const createMessageV0 = new TransactionMessage({
      payerKey: founderPubkey,
      recentBlockhash: blockhash1,
      instructions: [computeBudget1, createIx],
    }).compileToV0Message();

    const createTx = new VersionedTransaction(createMessageV0);
    const serializedCreateTx = Buffer.from(createTx.serialize()).toString('base64');

    logger.info('✅ TX1 (Create Token) prepared', {
      size: createTx.serialize().length,
      payer: founderPubkey.toBase58(),
    });

    // ═══════════════════════════════════════════════════════════════
    // TRANSACTION 2: RESOLVE MARKET (with Jito tip)
    // ═══════════════════════════════════════════════════════════════

    const { blockhash: blockhash2, lastValidBlockHeight: lastValidBlockHeight2 } =
      await connection.getLatestBlockhash('confirmed');

    // Compute budget for resolve (800k CU for CPI + ATA creation)
    const computeBudget2 = ComputeBudgetProgram.setComputeUnitLimit({
      units: 800_000,
    });

    // Create market's ATA instruction
    const createATAIx = createAssociatedTokenAccountInstruction(
      callerPubkey,
      marketTokenAccount,
      marketPubkey,
      tokenMintPubkey,
      TOKEN_2022_PROGRAM_ID
    );

    // Build resolve_market instruction
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:resolve_market', 'utf8')
      .digest()
      .subarray(0, 8);

    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    const { TransactionInstruction } = await import('@solana/web3.js');
    const resolveIx = new TransactionInstruction({
      keys: [
        // Core market accounts (2)
        { pubkey: marketPubkey, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },

        // Pump.fun buy() CPI accounts - EXACT order per official IDL (16 accounts)
        { pubkey: pumpPDAs.global, isSigner: false, isWritable: false },
        { pubkey: PUMP_FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: tokenMintPubkey, isSigner: false, isWritable: true },
        { pubkey: pumpPDAs.bondingCurve, isSigner: false, isWritable: true },
        { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true },
        { pubkey: marketTokenAccount, isSigner: false, isWritable: true },
        { pubkey: marketPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: creatorVault, isSigner: false, isWritable: true },
        { pubkey: pumpPDAs.eventAuthority, isSigner: false, isWritable: false },
        { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: true },
        { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
        { pubkey: feeConfig, isSigner: false, isWritable: false },
        { pubkey: PUMP_FEE_PROGRAM_ID, isSigner: false, isWritable: false },

        // Additional program accounts (5)
        { pubkey: callerPubkey, isSigner: true, isWritable: true },
        { pubkey: creatorPubkey, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: programId,
      data,
    });

    // Create Jito tip instruction (MUST BE LAST!)
    const jitoTipIx = await createJitoTipInstruction(callerPubkey, MINIMUM_JITO_TIP);

    // Fetch Address Lookup Table
    const lookupTableAccount = await connection.getAddressLookupTable(ALT_ADDRESS);
    if (!lookupTableAccount.value) {
      throw new Error('Address Lookup Table not found');
    }

    const resolveMessageV0 = new TransactionMessage({
      payerKey: callerPubkey,
      recentBlockhash: blockhash2,
      instructions: [computeBudget2, createATAIx, resolveIx, jitoTipIx], // Tip LAST!
    }).compileToV0Message([lookupTableAccount.value]);

    const resolveTx = new VersionedTransaction(resolveMessageV0);
    const serializedResolveTx = Buffer.from(resolveTx.serialize()).toString('base64');

    logger.info('✅ TX2 (Resolve Market + Jito Tip) prepared', {
      size: resolveTx.serialize().length,
      payer: callerPubkey.toBase58(),
      jitoTip: MINIMUM_JITO_TIP,
    });

    // ═══════════════════════════════════════════════════════════════
    // RETURN BOTH TRANSACTIONS
    // ═══════════════════════════════════════════════════════════════

    return NextResponse.json({
      success: true,
      data: {
        // Transaction 1: Create token
        createTransaction: serializedCreateTx,
        createSigners: ['founder', 'mint'], // Frontend needs to sign with both
        createLastValidBlockHeight: lastValidBlockHeight1,

        // Transaction 2: Resolve market
        resolveTransaction: serializedResolveTx,
        resolveSigners: ['caller'],
        resolveLastValidBlockHeight: lastValidBlockHeight2,

        // Jito info
        jitoTipAmount: MINIMUM_JITO_TIP,
        jitoTipLamports: MINIMUM_JITO_TIP,

        // Metadata
        treasuryPda: treasuryPda.toBase58(),
        tokenMint: tokenMintPubkey.toBase58(),
        marketTokenAccount: marketTokenAccount.toBase58(),
      },
    });
  } catch (error) {
    logger.error('Failed to prepare Jito bundle:', {
      error: error instanceof Error ? error.message : String(error),
    });

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare Jito bundle',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
