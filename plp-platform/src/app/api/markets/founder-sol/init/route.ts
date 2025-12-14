/**
 * API endpoint for preparing init founder SOL vesting transactions
 *
 * This endpoint builds an init_founder_vesting transaction and returns
 * a serialized transaction for client-side signing.
 *
 * Called after YES wins when pool > 50 SOL to set up founder's excess SOL vesting.
 * Distribution: 8% immediate + 92% vested over 12 months
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

    logger.info('Preparing init founder SOL vesting transaction', {
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

    // Build init_founder_vesting instruction manually
    // Calculate discriminator: sha256("global:init_founder_vesting")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:init_founder_vesting', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for init_founder_vesting - just discriminator
    // The on-chain instruction reads excess SOL from market.founder_excess_sol_allocated
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const initFounderVestingIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },           // market
        { pubkey: founderVestingPda, isSigner: false, isWritable: true },      // founder_vesting (to be created)
        { pubkey: founderPubkey, isSigner: true, isWritable: true },           // founder (pays for account)
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
      instructions: [computeBudgetIx, initFounderVestingIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Init founder SOL vesting transaction prepared successfully', {
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
    logger.error('Failed to prepare init founder SOL vesting transaction:', error as any);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare init founder SOL vesting transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
