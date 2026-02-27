/**
 * API endpoint for preparing close market transactions
 *
 * This endpoint builds a close_market transaction and returns
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
    const { marketAddress, founderWallet, network } = body;

    // Validate inputs
    if (!marketAddress || !founderWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, founderWallet',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing close market transaction', {
      marketAddress,
      founderWallet,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const founderPubkey = new PublicKey(founderWallet);

    // Get connection
    const connection = await getSolanaConnection(network);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Build close_market instruction manually
    // Calculate closeMarket discriminator: sha256("global:close_market")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:close_market', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for close_market - just discriminator
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const closeMarketIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },          // market (will be closed)
        { pubkey: founderPubkey, isSigner: true, isWritable: true },          // founder (receives rent)
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
      payerKey: founderPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, closeMarketIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Close market transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare close market transaction:', error);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare close market transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
