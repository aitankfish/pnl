/**
 * API endpoint for preparing market resolution transactions
 *
 * This endpoint builds a resolve_market transaction and returns
 * a serialized transaction for client-side signing
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
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { getTreasuryPDA } from '@/lib/anchor-program';
import { derivePumpPDAs, PUMP_PROGRAM_ID } from '@/lib/pumpfun';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, callerWallet } = body;

    // Validate inputs
    if (!marketAddress || !callerWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, callerWallet',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing market resolution transaction', {
      marketAddress,
      callerWallet,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const callerPubkey = new PublicKey(callerWallet);

    // Derive Treasury PDA
    const [treasuryPda] = getTreasuryPDA();

    // Create a dummy token mint for pump.fun accounts
    // These accounts are required by the Anchor struct but won't be used for NO wins
    // We can't use PublicKey.default because it can't be marked as writable (mut)
    // So we derive a PDA from the market as a dummy mint
    const [dummyMintPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from('dummy_mint'), marketPubkey.toBuffer()],
      new PublicKey(await (await import('@/config/solana')).PROGRAM_ID)
    );

    // Derive pump.fun PDAs (using dummy mint)
    const pumpPDAs = derivePumpPDAs(dummyMintPubkey);

    // Get market's token account (ATA) for dummy mint
    const marketTokenAccount = await getAssociatedTokenAddress(
      dummyMintPubkey,
      marketPubkey,
      true // allowOwnerOffCurve
    );

    // Get bonding curve's token account (ATA)
    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      dummyMintPubkey,
      pumpPDAs.bondingCurve,
      true
    );

    logger.info('Treasury PDA and pump.fun accounts derived', {
      treasuryPda: treasuryPda.toBase58(),
      pumpGlobal: pumpPDAs.global.toBase58(),
      bondingCurve: pumpPDAs.bondingCurve.toBase58(),
    });

    // Get connection
    const connection = await getSolanaConnection();

    // Build resolve_market instruction manually (since IDL is incomplete)
    // Calculate resolveMarket discriminator: sha256("global:resolve_market")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:resolve_market', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for resolveMarket - just discriminator
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Create instruction with all accounts (same structure as prepare-jito-bundle)
    // Note: For NO wins, pump.fun accounts are dummy placeholders and won't be used
    const { TransactionInstruction } = await import('@solana/web3.js');
    const resolveIx = new TransactionInstruction({
      keys: [
        // Original 4 accounts
        { pubkey: marketPubkey, isSigner: false, isWritable: true },       // market
        { pubkey: treasuryPda, isSigner: false, isWritable: true },        // treasury

        // Pump.fun accounts (13 accounts - dummy for NO wins, required by Anchor struct)
        { pubkey: dummyMintPubkey, isSigner: false, isWritable: true },    // token_mint
        { pubkey: marketTokenAccount, isSigner: false, isWritable: true }, // market_token_account
        { pubkey: pumpPDAs.global, isSigner: false, isWritable: true },    // pump_global
        { pubkey: pumpPDAs.bondingCurve, isSigner: false, isWritable: true }, // bonding_curve
        { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true }, // bonding_curve_token_account
        { pubkey: pumpPDAs.global, isSigner: false, isWritable: true },    // pump_fee_recipient (same as global)
        { pubkey: pumpPDAs.eventAuthority, isSigner: false, isWritable: false }, // pump_event_authority
        { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },   // pump_program

        // Remaining accounts
        { pubkey: callerPubkey, isSigner: true, isWritable: true },        // caller
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },  // token_program
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Build compute budget instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction (same as create page)
    const messageV0 = new TransactionMessage({
      payerKey: callerPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, resolveIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Market resolution transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        treasuryPda: treasuryPda.toBase58(),
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare market resolution transaction:', error);

    // Log the full error stack for debugging
    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare market resolution transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
