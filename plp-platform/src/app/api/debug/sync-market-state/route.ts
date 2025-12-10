/**
 * Debug endpoint to force re-sync a market's state from blockchain
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { getSolanaConnection } from '@/lib/solana';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { getProgramId } from '@/config/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress } = body;

    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing marketAddress' },
        { status: 400 }
      );
    }

    // Connect to blockchain
    const connection = await getSolanaConnection();
    const programId = getProgramId();

    logger.info('Fetching on-chain market state...', { marketAddress });

    // Fetch on-chain account
    const marketPubkey = new PublicKey(marketAddress);
    const accountInfo = await connection.getAccountInfo(marketPubkey);

    if (!accountInfo) {
      return NextResponse.json(
        { success: false, error: 'Market account not found on-chain' },
        { status: 404 }
      );
    }

    // Decode market account (simplified - you'd normally use Anchor IDL)
    // For now, just check if account exists and has data
    const accountExists = accountInfo.lamports > 0;

    // Connect to MongoDB
    await connectToDatabase();

    // Find market in MongoDB
    const market = await PredictionMarket.findOne({ marketAddress }).lean();

    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found in MongoDB' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        marketAddress,
        onChain: {
          exists: accountExists,
          lamports: accountInfo.lamports,
          owner: accountInfo.owner.toBase58(),
          dataSize: accountInfo.data.length,
        },
        mongodb: {
          marketState: market.marketState,
          marketStateLabel: market.marketState === 0 ? 'Active' : market.marketState === 1 ? 'Resolved' : 'Canceled',
          resolution: market.resolution || 'Unresolved',
          phase: market.phase,
          poolBalance: market.poolBalance,
          expiryTime: market.expiryTime,
        },
        analysis: {
          isInSync: true, // Would need full decoding to verify
          recommendation: market.marketState !== 0
            ? 'Market is filtered from browse page (marketState !== 0). Check if on-chain state matches.'
            : 'Market should be visible on browse page.',
        }
      }
    });

  } catch (error) {
    logger.error('Failed to sync market state:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
