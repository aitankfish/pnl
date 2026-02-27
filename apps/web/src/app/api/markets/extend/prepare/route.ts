/**
 * API endpoint for preparing extend market transactions
 *
 * This endpoint builds an extend_market transaction and returns
 * a serialized transaction for client-side signing
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { getTreasuryPDA } from '@/lib/anchor-program';
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

    logger.info('Preparing extend market transaction', {
      marketAddress,
      founderWallet,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const founderPubkey = new PublicKey(founderWallet);

    logger.info('Extend market transaction prepared', {
      marketPubkey: marketPubkey.toBase58(),
      founderPubkey: founderPubkey.toBase58(),
    });

    // Get connection
    const connection = await getSolanaConnection(network);

    // Build extend_market instruction manually
    // Calculate extendMarket discriminator: sha256("global:extend_market")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:extend_market', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for extendMarket - just discriminator
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Create instruction
    // According to extend_market.rs, only market and founder are needed
    const { TransactionInstruction } = await import('@solana/web3.js');
    const extendIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },       // market
        { pubkey: founderPubkey, isSigner: true, isWritable: true },       // founder (only founder can extend)
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Build compute budget instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200_000,
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction
    const messageV0 = new TransactionMessage({
      payerKey: founderPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, extendIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Extend market transaction prepared successfully', {
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
    logger.error('Failed to prepare extend market transaction:', error);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare extend market transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
