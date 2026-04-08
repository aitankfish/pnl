/**
 * API endpoint for fetching market position holders
 *
 * Returns YES and NO holders with their positions
 * Uses MongoDB for both devnet and mainnet
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { connectToDatabase as connectRawDb, getDatabase } from '@/lib/database/index';
import { COLLECTIONS } from '@/lib/database/models';
import { createClientLogger } from '@/lib/logger';
import { SOLANA_NETWORK } from '@/config/solana';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

interface PositionHolder {
  wallet: string;
  totalAmount: number; // Total SOL staked
  tradeCount: number;
  percentage: number; // Percentage of their side's pool
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;

    // Get network from query parameter (frontend can pass this)
    // Fallback to environment variable if not provided
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network = (networkParam as 'mainnet-beta' | 'devnet' | null) || SOLANA_NETWORK;
    const isMainnet = network === 'mainnet-beta';

    logger.info('Fetching market holders', { marketId, network, source: isMainnet ? 'helius' : 'mongodb' });

    // Connect to both database systems
    await connectToDatabase(); // Mongoose connection
    await connectRawDb(); // Raw MongoDB driver connection

    // Get market document to find on-chain address (using Mongoose model)
    const market = await PredictionMarket.findById(marketId).lean();

    if (!market) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    const marketAddress = market.marketAddress;

    if (!marketAddress) {
      logger.error('Market has no on-chain address', { marketId });
      return NextResponse.json(
        {
          success: false,
          error: 'Market has no on-chain address',
        },
        { status: 400 }
      );
    }

    // Fetch votes from MongoDB (both devnet and mainnet)
    // Trade history is stored in MongoDB by /vote/complete endpoint
    const db = getDatabase();
    const trades = await db.collection(COLLECTIONS.TRADE_HISTORY)
      .find({ marketAddress })
      .sort({ createdAt: -1 })
      .limit(1000)
      .toArray();

    const votes = trades.map(trade => ({
      signature: trade.signature,
      traderWallet: trade.traderWallet,
      voteType: trade.voteType as 'yes' | 'no',
      amount: trade.amount,
      timestamp: trade.createdAt.getTime(),
      blockTime: Math.floor(trade.createdAt.getTime() / 1000),
    }));

    // Aggregate positions by wallet and vote type from Helius data
    const yesHolders = new Map<string, { amount: number; count: number }>();
    const noHolders = new Map<string, { amount: number; count: number }>();

    votes.forEach((vote) => {
      const wallet = vote.traderWallet;
      const amount = vote.amount / 1_000_000_000; // Convert to SOL

      if (vote.voteType === 'yes') {
        const existing = yesHolders.get(wallet) || { amount: 0, count: 0 };
        yesHolders.set(wallet, {
          amount: existing.amount + amount,
          count: existing.count + 1,
        });
      } else {
        const existing = noHolders.get(wallet) || { amount: 0, count: 0 };
        noHolders.set(wallet, {
          amount: existing.amount + amount,
          count: existing.count + 1,
        });
      }
    });

    // Calculate totals for percentage calculations
    const totalYesStake = Array.from(yesHolders.values()).reduce(
      (sum, holder) => sum + holder.amount,
      0
    );
    const totalNoStake = Array.from(noHolders.values()).reduce(
      (sum, holder) => sum + holder.amount,
      0
    );

    // Transform to arrays and sort by stake amount (descending)
    const yesHoldersList: PositionHolder[] = Array.from(yesHolders.entries())
      .map(([wallet, data]) => ({
        wallet,
        totalAmount: data.amount,
        tradeCount: data.count,
        percentage:
          totalYesStake > 0 ? (data.amount / totalYesStake) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const noHoldersList: PositionHolder[] = Array.from(noHolders.entries())
      .map(([wallet, data]) => ({
        wallet,
        totalAmount: data.amount,
        tradeCount: data.count,
        percentage: totalNoStake > 0 ? (data.amount / totalNoStake) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    logger.info('Market holders fetched', {
      marketId,
      yesHoldersCount: yesHoldersList.length,
      noHoldersCount: noHoldersList.length,
      totalYesStake,
      totalNoStake,
    });

    return NextResponse.json({
      success: true,
      data: {
        yesHolders: yesHoldersList,
        noHolders: noHoldersList,
        totalYesStake,
        totalNoStake,
        totalHolders: yesHoldersList.length + noHoldersList.length,
        uniqueHolders: new Set([
          ...yesHoldersList.map((h) => h.wallet),
          ...noHoldersList.map((h) => h.wallet),
        ]).size,
      },
      source: isMainnet ? 'helius' : 'mongodb',
      network, // Include network in response for debugging
    });
  } catch (error) {
    logger.error('Failed to fetch market holders:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market holders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
