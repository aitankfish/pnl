/**
 * API endpoint for preparing claim founder SOL transactions
 *
 * This endpoint builds a claim_founder_sol transaction and returns
 * a serialized transaction for client-side signing.
 *
 * Called by founder to claim vested SOL (8% immediate + linear vested over 12 months)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
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

    logger.info('Preparing claim founder SOL transaction', {
      marketAddress,
      founderWallet,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const founderPubkey = new PublicKey(founderWallet);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Derive founder_vesting PDA
    const [founderVestingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('founder_vesting'), marketPubkey.toBytes()],
      PROGRAM_ID
    );

    logger.info('Founder vesting PDA derived', {
      founderVestingPda: founderVestingPda.toBase58(),
    });

    // Get connection
    const connection = await getSolanaConnection(network);

    // Build claim_founder_sol instruction manually
    // Calculate discriminator: sha256("global:claim_founder_sol")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:claim_founder_sol', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for claim_founder_sol - just discriminator
    // The on-chain instruction calculates claimable amount based on vesting schedule
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const claimFounderSolIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },           // market
        { pubkey: founderVestingPda, isSigner: false, isWritable: true },      // founder_vesting
        { pubkey: founderPubkey, isSigner: true, isWritable: true },           // founder
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
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
      instructions: [computeBudgetIx, claimFounderSolIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Claim founder SOL transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      founderVestingPda: founderVestingPda.toBase58(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        founderVestingPda: founderVestingPda.toBase58(),
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare claim founder SOL transaction:', error as any);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare claim founder SOL transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
