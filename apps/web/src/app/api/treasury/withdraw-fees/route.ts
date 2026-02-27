/**
 * API endpoint for withdrawing fees from treasury
 * Only admin can call this
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
    const { admin, recipient, amount, network } = body;

    // Validate inputs
    if (!admin || !recipient || !amount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: admin, recipient, amount',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing withdraw fees transaction', {
      admin,
      recipient,
      amount,
      network,
    });

    // Convert addresses to PublicKey
    const adminPubkey = new PublicKey(admin);
    const recipientPubkey = new PublicKey(recipient);

    // Derive Treasury PDA
    const [treasuryPda, treasuryBump] = getTreasuryPDA();

    // Get connection
    const connection = await getSolanaConnection(network);

    // Build withdraw_fees instruction
    // Calculate discriminator: sha256("global:withdraw_fees")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:withdraw_fees', 'utf8')
      .digest()
      .subarray(0, 8);

    // Args: amount (u64 = 8 bytes)
    const data = Buffer.alloc(8 + 8);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(amount), 8);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const withdrawFeesIx = new TransactionInstruction({
      keys: [
        { pubkey: treasuryPda, isSigner: false, isWritable: true },     // treasury
        { pubkey: adminPubkey, isSigner: true, isWritable: true },       // admin
        { pubkey: recipientPubkey, isSigner: false, isWritable: true },  // recipient
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction
    const messageV0 = new TransactionMessage({
      payerKey: adminPubkey,
      recentBlockhash: blockhash,
      instructions: [withdrawFeesIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Withdraw fees transaction prepared', {
      treasuryPda: treasuryPda.toBase58(),
      admin: adminPubkey.toBase58(),
      recipient: recipientPubkey.toBase58(),
      amount: amount.toString(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        treasuryPda: treasuryPda.toBase58(),
        recipient: recipientPubkey.toBase58(),
        amount: amount.toString(),
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare withdraw fees transaction:', error);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare withdraw fees transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
