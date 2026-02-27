/**
 * API endpoint for initializing the treasury PDA
 * Only the deployer wallet can call this (one-time setup)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
} from '@solana/web3.js';
import { getTreasuryPDA } from '@/lib/anchor-program';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callerWallet, network } = body;

    // Validate inputs
    if (!callerWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: callerWallet',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing treasury initialization', {
      callerWallet,
      network,
    });

    // Convert addresses to PublicKey
    const callerPubkey = new PublicKey(callerWallet);

    // Derive Treasury PDA
    const [treasuryPda, treasuryBump] = getTreasuryPDA(network as 'devnet' | 'mainnet-beta');

    logger.info('Treasury PDA derived', {
      network,
      treasuryPda: treasuryPda.toBase58(),
      treasuryBump,
    });

    // Get connection
    const connection = await getSolanaConnection(network);

    // Build init_treasury instruction
    // Calculate discriminator: sha256("global:init_treasury")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:init_treasury', 'utf8')
      .digest()
      .subarray(0, 8);

    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Get program ID for the specified network
    const { getProgramIdForNetwork } = await import('@/lib/anchor-program');
    const programId = getProgramIdForNetwork(network as 'devnet' | 'mainnet-beta');

    logger.info('Using program ID', {
      network,
      programId: programId.toBase58(),
    });

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const initTreasuryIx = new TransactionInstruction({
      keys: [
        { pubkey: treasuryPda, isSigner: false, isWritable: true },  // treasury
        { pubkey: callerPubkey, isSigner: true, isWritable: true },  // payer
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: programId,
      data,
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction
    const messageV0 = new TransactionMessage({
      payerKey: callerPubkey,
      recentBlockhash: blockhash,
      instructions: [initTreasuryIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Treasury initialization transaction prepared', {
      treasuryPda: treasuryPda.toBase58(),
      callerWallet: callerPubkey.toBase58(),
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
    logger.error('Failed to prepare treasury initialization:', { error: error instanceof Error ? error.message : String(error) });

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare treasury initialization',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
