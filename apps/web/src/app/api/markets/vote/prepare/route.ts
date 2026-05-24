/**
 * API endpoint for preparing vote transactions
 *
 * This endpoint builds a buy_yes or buy_no transaction and returns
 * a serialized transaction for client-side signing
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { buildBuyYesTransaction, buildBuyNoTransaction } from '@/lib/anchor-program';
import { createClientLogger } from '@/lib/logger';
import { SOLANA_NETWORK, RPC_ENDPOINT } from '@/config/solana';
import { withWalletOwnership } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';

const logger = createClientLogger();

export const POST = withWalletOwnership(async (request, authUser) => {
  try {
    // Rate limit: 10 vote preps per minute per wallet
    const rateLimited = await checkRateLimit(`vote:${authUser.walletAddress}`, 10, 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { marketAddress, voteType, amount, network } = body;
    const userWallet = authUser.walletAddress;

    // Use provided network or fall back to SOLANA_NETWORK constant
    const targetNetwork = (network as 'devnet' | 'mainnet-beta') || SOLANA_NETWORK;

    // Validate inputs
    if (!marketAddress || !voteType || !amount || !userWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, voteType, amount, userWallet',
        },
        { status: 400 }
      );
    }

    // Validate vote type
    if (voteType !== 'yes' && voteType !== 'no') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid vote type. Must be "yes" or "no"',
        },
        { status: 400 }
      );
    }

    // Validate amount (minimum 0.01 SOL = 10_000_000 lamports)
    const lamports = Math.floor(amount * 1_000_000_000);
    if (lamports < 10_000_000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Minimum vote amount is 0.01 SOL',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing vote transaction', {
      marketAddress,
      voteType,
      amount,
      lamports,
      userWallet,
      network: targetNetwork,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const userPubkey = new PublicKey(userWallet);

    // Debug: Check Treasury PDA derivation
    const { getTreasuryPDA } = await import('@/lib/anchor-program');
    const [treasuryPda] = getTreasuryPDA(targetNetwork);
    logger.info('Treasury PDA being used', { treasuryPda: treasuryPda.toBase58() });

    // Build transaction based on vote type. rpcEndpoint is the server-resolved
    // URL (built from HELIUS_API_KEY) so getLatestBlockhash doesn't depend on
    // the browser-side NEXT_PUBLIC_HELIUS_MAINNET_RPC being correct in deploy env.
    const result = voteType === 'yes'
      ? await buildBuyYesTransaction({
          market: marketPubkey,
          user: userPubkey,
          solAmount: lamports,
          network: targetNetwork,
          rpcEndpoint: RPC_ENDPOINT,
        })
      : await buildBuyNoTransaction({
          market: marketPubkey,
          user: userPubkey,
          solAmount: lamports,
          network: targetNetwork,
          rpcEndpoint: RPC_ENDPOINT,
        });

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(result.transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })).toString('base64');

    logger.info('Vote transaction prepared successfully', {
      voteType,
      positionPda: result.positionPda,
      serializedLength: serializedTransaction.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        positionPda: result.positionPda,
        voteType,
        amount,
        lamports,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare vote transaction', { error });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare vote transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}, 'userWallet');
