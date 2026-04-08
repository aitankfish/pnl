/**
 * API endpoint for fetching market trade history
 *
 * Returns time-series data for probability chart and recent trades
 * Uses MongoDB for both devnet and mainnet
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { connectToDatabase as connectRawDb, getDatabase } from '@/lib/database/index';
import { COLLECTIONS } from '@/lib/database/models';
import { createClientLogger } from '@/lib/logger';
import { ParsedVote } from '@/lib/helius';
import { SOLANA_NETWORK } from '@/config/solana';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

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

    logger.info('Fetching trade history', { marketId, network, source: isMainnet ? 'helius' : 'mongodb' });

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

    // Hide chart data for unresolved markets to prevent bandwagon voting
    // Return empty data - users can still see trade count but not vote direction breakdown
    if (market.resolution === 'Unresolved') {
      logger.info('Hiding chart data for unresolved market', { marketId });
      return NextResponse.json({
        success: true,
        data: {
          chartData: [],
          recentTrades: [],
          totalTrades: 0,
          hidden: true, // Flag to indicate data is intentionally hidden
          message: 'Vote data hidden until market resolution',
        },
        network,
      });
    }

    let votes: ParsedVote[];

    // Use MongoDB for both devnet and mainnet
    // Trade history is stored in MongoDB by /vote/complete endpoint
    logger.info('Fetching votes from MongoDB', { marketId, marketAddress, network });
    const db = getDatabase();
    const trades = await db.collection(COLLECTIONS.TRADE_HISTORY)
      .find({ marketAddress })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    votes = trades.map(trade => ({
      signature: trade.signature,
      traderWallet: trade.traderWallet,
      voteType: trade.voteType as 'yes' | 'no',
      amount: trade.amount,
      timestamp: trade.createdAt.getTime(),
      blockTime: Math.floor(trade.createdAt.getTime() / 1000),
    }));

    logger.info('Fetched votes', {
      marketId,
      marketAddress,
      voteCount: votes.length,
      source: 'mongodb',
    });

    // Calculate running probabilities for chart
    let yesShares = 0;
    let noShares = 0;
    const chartData: any[] = [];

    // Process votes chronologically (oldest first for chart)
    const chronologicalVotes = [...votes].reverse();

    for (const vote of chronologicalVotes) {
      // Update share counts
      // Note: For more accurate pricing, you'd need to implement the constant product formula
      // For now, using simple proportional calculation
      if (vote.voteType === 'yes') {
        yesShares += vote.amount;
      } else {
        noShares += vote.amount;
      }

      const total = yesShares + noShares;
      const yesPrice = total > 0 ? (yesShares / total) * 100 : 50;
      const noPrice = total > 0 ? (noShares / total) * 100 : 50;

      chartData.push({
        timestamp: vote.timestamp,
        time: new Date(vote.timestamp).toISOString(),
        yesPrice,
        noPrice,
        amount: vote.amount / 1_000_000_000, // Convert to SOL
        voteType: vote.voteType,
      });
    }

    // Get recent trades for activity feed (last 20, newest first)
    const recentTrades = votes.slice(0, 20).map((vote) => ({
      id: vote.signature,
      traderWallet: vote.traderWallet,
      voteType: vote.voteType,
      amount: vote.amount / 1_000_000_000, // Convert to SOL
      yesPrice: chartData[chartData.length - 1]?.yesPrice || 50,
      noPrice: chartData[chartData.length - 1]?.noPrice || 50,
      signature: vote.signature,
      timestamp: vote.timestamp,
      timeAgo: getTimeAgo(new Date(vote.timestamp)),
    }));

    logger.info('Trade history processed', {
      marketId,
      totalTrades: votes.length,
      recentTrades: recentTrades.length,
      chartPoints: chartData.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        chartData,
        recentTrades,
        totalTrades: votes.length,
      },
      source: isMainnet ? 'helius' : 'mongodb',
      network, // Include network in response for debugging
    });
  } catch (error) {
    logger.error('Failed to fetch trade history:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trade history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate "time ago" string
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
