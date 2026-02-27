/**
 * API endpoint for changing treasury admin
 * Only current admin can call this
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { getTreasuryPDA } from '@/lib/anchor-program';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentAdmin, newAdmin, network } = body;

    // Validate inputs
    if (!currentAdmin || !newAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: currentAdmin, newAdmin',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing set admin transaction', {
      currentAdmin,
      newAdmin,
      network,
    });

    // Convert addresses to PublicKey
    const currentAdminPubkey = new PublicKey(currentAdmin);
    const newAdminPubkey = new PublicKey(newAdmin);

    // Derive Treasury PDA
    const [treasuryPda, treasuryBump] = getTreasuryPDA();

    // Get connection
    const connection = await getSolanaConnection(network);

    // Build set_admin instruction
    // Calculate discriminator: sha256("global:set_admin")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:set_admin', 'utf8')
      .digest()
      .subarray(0, 8);

    // Args: new_admin (Pubkey = 32 bytes)
    const data = Buffer.alloc(8 + 32);
    discriminator.copy(data, 0);
    newAdminPubkey.toBuffer().copy(data, 8);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const setAdminIx = new TransactionInstruction({
      keys: [
        { pubkey: treasuryPda, isSigner: false, isWritable: true },        // treasury
        { pubkey: currentAdminPubkey, isSigner: true, isWritable: true },  // current_admin
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction
    const messageV0 = new TransactionMessage({
      payerKey: currentAdminPubkey,
      recentBlockhash: blockhash,
      instructions: [setAdminIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Set admin transaction prepared', {
      treasuryPda: treasuryPda.toBase58(),
      currentAdmin: currentAdminPubkey.toBase58(),
      newAdmin: newAdminPubkey.toBase58(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        treasuryPda: treasuryPda.toBase58(),
        newAdmin: newAdminPubkey.toBase58(),
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare set admin transaction:', error);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare set admin transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
