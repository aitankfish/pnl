/**
 * API endpoint for preparing claim platform tokens transactions
 *
 * This endpoint builds a claim_platform_tokens transaction and returns
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
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

// P&L Platform wallet (from constants in program)
const PNL_WALLET = '3MihVtsLsVuEccpmz4YG72Cr8CJWf1evRorTPdPiHeEQ';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, callerWallet, tokenMint, network } = body;

    // Validate inputs
    if (!marketAddress || !callerWallet || !tokenMint) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, callerWallet, tokenMint',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing claim platform tokens transaction', {
      marketAddress,
      callerWallet,
      tokenMint,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const callerPubkey = new PublicKey(callerWallet);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const pnlWalletPubkey = new PublicKey(PNL_WALLET);

    // Get associated token accounts (Token2022 - Pump.fun uses Token2022)
    const marketTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      marketPubkey,
      true, // allowOwnerOffCurve - market is a PDA
      TOKEN_2022_PROGRAM_ID
    );

    const pnlTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      pnlWalletPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    logger.info('Token accounts derived', {
      marketTokenAccount: marketTokenAccount.toBase58(),
      pnlTokenAccount: pnlTokenAccount.toBase58(),
      pnlWallet: PNL_WALLET,
    });

    // Get connection
    const connection = await getSolanaConnection(network);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // Build claim_platform_tokens instruction manually
    // Calculate claimPlatformTokens discriminator: sha256("global:claim_platform_tokens")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:claim_platform_tokens', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for claim_platform_tokens - just discriminator
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Create instruction
    const { TransactionInstruction } = await import('@solana/web3.js');
    const claimPlatformTokensIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },           // market
        { pubkey: marketTokenAccount, isSigner: false, isWritable: true },     // market_token_account
        { pubkey: pnlTokenAccount, isSigner: false, isWritable: true },        // pnl_token_account
        { pubkey: tokenMintPubkey, isSigner: false, isWritable: false },       // token_mint
        { pubkey: callerPubkey, isSigner: true, isWritable: true },            // caller (can be anyone)
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program (Token2022)
      ],
      programId: PROGRAM_ID,
      data,
    });

    // Create PNL token account if it doesn't exist (idempotent - safe to call even if exists)
    const createPnlTokenAccountIx = createAssociatedTokenAccountIdempotentInstruction(
      callerPubkey,      // payer
      pnlTokenAccount,   // associated token account address
      pnlWalletPubkey,   // owner
      tokenMintPubkey,   // mint
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Build compute budget instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300_000, // Increased for ATA creation
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction
    const messageV0 = new TransactionMessage({
      payerKey: callerPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, createPnlTokenAccountIx, claimPlatformTokensIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Claim platform tokens transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      marketTokenAccount: marketTokenAccount.toBase58(),
      pnlTokenAccount: pnlTokenAccount.toBase58(),
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
    logger.error('Failed to prepare claim platform tokens transaction:', error);

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare claim platform tokens transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
