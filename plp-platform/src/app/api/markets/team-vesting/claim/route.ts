/**
 * API endpoint for preparing claim team tokens transactions
 *
 * This endpoint builds a claim_team_tokens transaction and returns
 * a serialized transaction for client-side signing
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, teamWallet, tokenMint, network } = body;

    // Validate inputs
    if (!marketAddress || !teamWallet || !tokenMint) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, teamWallet, tokenMint',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing claim team tokens transaction', {
      marketAddress,
      teamWallet,
      tokenMint,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const teamWalletPubkey = new PublicKey(teamWallet);
    const tokenMintPubkey = new PublicKey(tokenMint);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Derive team_vesting PDA
    const [teamVestingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('team_vesting'), marketPubkey.toBytes()],
      PROGRAM_ID
    );

    // Get associated token accounts (using Token2022 for Pump.fun tokens)
    const marketTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      marketPubkey,
      true, // allowOwnerOffCurve - market is a PDA
      TOKEN_2022_PROGRAM_ID // Pump.fun uses Token2022
    );

    const teamTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      teamWalletPubkey,
      false,
      TOKEN_2022_PROGRAM_ID // Pump.fun uses Token2022
    );

    logger.info('Token accounts derived', {
      teamVestingPda: teamVestingPda.toBase58(),
      marketTokenAccount: marketTokenAccount.toBase58(),
      teamTokenAccount: teamTokenAccount.toBase58(),
    });

    // Get connection
    const connection = await getSolanaConnection(network);

    // Build claim_team_tokens instruction manually
    // Calculate claimTeamTokens discriminator: sha256("global:claim_team_tokens")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:claim_team_tokens', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for claim_team_tokens - just discriminator
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const claimTeamTokensIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },           // market
        { pubkey: teamVestingPda, isSigner: false, isWritable: true },         // team_vesting
        { pubkey: marketTokenAccount, isSigner: false, isWritable: true },     // market_token_account
        { pubkey: teamTokenAccount, isSigner: false, isWritable: true },       // team_token_account
        { pubkey: teamWalletPubkey, isSigner: true, isWritable: true },        // team_wallet
        { pubkey: tokenMintPubkey, isSigner: false, isWritable: false },       // token_mint
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program (Token2022 for Pump.fun)
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Build compute budget instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300_000,
    });

    // Create team token account if it doesn't exist (idempotent - safe to call even if exists)
    const createTeamTokenAccountIx = createAssociatedTokenAccountIdempotentInstruction(
      teamWalletPubkey,    // payer
      teamTokenAccount,    // associated token account address
      teamWalletPubkey,    // owner
      tokenMintPubkey,     // mint
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction
    const messageV0 = new TransactionMessage({
      payerKey: teamWalletPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, createTeamTokenAccountIx, claimTeamTokensIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Claim team tokens transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      teamVestingPda: teamVestingPda.toBase58(),
      marketTokenAccount: marketTokenAccount.toBase58(),
      teamTokenAccount: teamTokenAccount.toBase58(),
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
    logger.error('Failed to prepare claim team tokens transaction:', {
      error: error instanceof Error ? error.message : String(error)
    });

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare claim team tokens transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
