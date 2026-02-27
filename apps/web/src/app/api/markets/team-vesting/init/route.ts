/**
 * API endpoint for preparing init team vesting transactions
 *
 * This endpoint builds an init_team_vesting transaction and returns
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
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, teamWallet, callerWallet, totalTokenSupply, network } = body;

    // Validate inputs
    if (!marketAddress || !teamWallet || !callerWallet || !totalTokenSupply) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, teamWallet, callerWallet, totalTokenSupply',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing init team vesting transaction', {
      marketAddress,
      teamWallet,
      callerWallet,
      totalTokenSupply,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const teamWalletPubkey = new PublicKey(teamWallet);
    const callerPubkey = new PublicKey(callerWallet);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Derive team_vesting PDA
    const [teamVestingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('team_vesting'), marketPubkey.toBytes()],
      PROGRAM_ID
    );

    logger.info('Team vesting PDA derived', {
      teamVestingPda: teamVestingPda.toBase58(),
    });

    // Get connection
    const connection = await getSolanaConnection(network);

    // Build init_team_vesting instruction manually
    // Calculate initTeamVesting discriminator: sha256("global:init_team_vesting")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:init_team_vesting', 'utf8')
      .digest()
      .subarray(0, 8);

    // Serialize instruction data: [discriminator(8 bytes), total_token_supply(u64)]
    const data = Buffer.alloc(8 + 8);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(totalTokenSupply), 8);

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const initVestingIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },           // market
        { pubkey: teamVestingPda, isSigner: false, isWritable: true },         // team_vesting (to be created)
        { pubkey: teamWalletPubkey, isSigner: false, isWritable: false },      // team_wallet
        { pubkey: callerPubkey, isSigner: true, isWritable: true },            // caller (pays for account)
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
      payerKey: callerPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, initVestingIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Init team vesting transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      teamVestingPda: teamVestingPda.toBase58(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        teamVestingPda: teamVestingPda.toBase58(),
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare init team vesting transaction:', error);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare init team vesting transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
