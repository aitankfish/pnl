/**
 * API endpoint for preparing close position transactions
 *
 * This endpoint builds a close_position transaction and returns
 * a serialized transaction for client-side signing
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, userWallet, network } = body;

    // Validate inputs
    if (!marketAddress || !userWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, userWallet',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing close position transaction', {
      marketAddress,
      userWallet,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const userPubkey = new PublicKey(userWallet);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Derive position PDA
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPubkey.toBytes(), userPubkey.toBytes()],
      PROGRAM_ID
    );

    logger.info('Position PDA derived', {
      positionPda: positionPda.toBase58(),
    });

    // Get connection
    const connection = await getSolanaConnection(network);

    // Build close_position instruction manually
    // Calculate closePosition discriminator: sha256("global:close_position")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:close_position', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for close_position - just discriminator
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const closePositionIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: false },        // market
        { pubkey: positionPda, isSigner: false, isWritable: true },          // position (will be closed)
        { pubkey: userPubkey, isSigner: true, isWritable: true },            // user (receives rent)
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Build compute budget instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 100_000,
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction
    const messageV0 = new TransactionMessage({
      payerKey: userPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, closePositionIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Close position transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      positionPda: positionPda.toBase58(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        positionPda: positionPda.toBase58(),
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare close position transaction:', error);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare close position transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
