/**
 * Combined API endpoint for market activity data
 *
 * Returns trade history (chart + recent trades) AND holders data in a single request
 * This consolidates /history and /holders endpoints to reduce API calls
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
  totalAmount: number;
  tradeCount: number;
  percentage: number;
}

interface ParsedVote {
  signature: string;
  traderWallet: string;
  voteType: 'yes' | 'no';
  amount: number;
  timestamp: number;
  blockTime: number;
}

// Helper function to calculate "time ago" string
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;

    // Get network and include flags from query parameters
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network = (networkParam as 'mainnet-beta' | 'devnet' | null) || SOLANA_NETWORK;
    const isMainnet = network === 'mainnet-beta';

    // Optional: Allow clients to request only specific data
    const includeHistory = searchParams.get('history') !== 'false';
    const includeHolders = searchParams.get('holders') !== 'false';

    logger.info('Fetching market activity', { marketId, network, includeHistory, includeHolders });

    // Connect to both database systems
    await connectToDatabase();
    await connectRawDb();

    // Get market document to find on-chain address
    const market = await PredictionMarket.findById(marketId).lean();

    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    const marketAddress = market.marketAddress;

    if (!marketAddress) {
      logger.error('Market has no on-chain address', { marketId });
      return NextResponse.json(
        { success: false, error: 'Market has no on-chain address' },
        { status: 400 }
      );
    }

    // Fetch trades from MongoDB (single query for both history and holders)
    const db = getDatabase();
    const trades = await db.collection(COLLECTIONS.TRADE_HISTORY)
      .find({ marketAddress })
      .sort({ createdAt: -1 })
      .limit(1000) // Holders needs more data, history uses 100
      .toArray();

    // Parse votes once, use for both calculations
    const votes: ParsedVote[] = trades.map(trade => ({
      signature: trade.signature,
      traderWallet: trade.traderWallet,
      voteType: trade.voteType as 'yes' | 'no',
      amount: trade.amount,
      timestamp: trade.createdAt.getTime(),
      blockTime: Math.floor(trade.createdAt.getTime() / 1000),
    }));

    // Build response object
    const responseData: {
      chartData?: any[];
      recentTrades?: any[];
      totalTrades?: number;
      yesHolders?: PositionHolder[];
      noHolders?: PositionHolder[];
      totalYesStake?: number;
      totalNoStake?: number;
      totalHolders?: number;
      uniqueHolders?: number;
    } = {};

    // Process history data if requested
    if (includeHistory) {
      let yesShares = 0;
      let noShares = 0;
      const chartData: any[] = [];

      // Process votes chronologically (oldest first for chart)
      // Use only first 100 for chart performance
      const historyVotes = votes.slice(0, 100);
      const chronologicalVotes = [...historyVotes].reverse();

      for (const vote of chronologicalVotes) {
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
          amount: vote.amount / 1_000_000_000,
          voteType: vote.voteType,
        });
      }

      // Get recent trades (last 20, newest first)
      const recentTrades = historyVotes.slice(0, 20).map((vote) => ({
        id: vote.signature,
        traderWallet: vote.traderWallet,
        voteType: vote.voteType,
        amount: vote.amount / 1_000_000_000,
        yesPrice: chartData[chartData.length - 1]?.yesPrice || 50,
        noPrice: chartData[chartData.length - 1]?.noPrice || 50,
        signature: vote.signature,
        timestamp: vote.timestamp,
        timeAgo: getTimeAgo(new Date(vote.timestamp)),
      }));

      responseData.chartData = chartData;
      responseData.recentTrades = recentTrades;
      responseData.totalTrades = votes.length;
    }

    // Process holders data if requested
    if (includeHolders) {
      const yesHolders = new Map<string, { amount: number; count: number }>();
      const noHolders = new Map<string, { amount: number; count: number }>();

      votes.forEach((vote) => {
        const wallet = vote.traderWallet;
        const amount = vote.amount / 1_000_000_000;

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

      const totalYesStake = Array.from(yesHolders.values()).reduce(
        (sum, holder) => sum + holder.amount,
        0
      );
      const totalNoStake = Array.from(noHolders.values()).reduce(
        (sum, holder) => sum + holder.amount,
        0
      );

      const yesHoldersList: PositionHolder[] = Array.from(yesHolders.entries())
        .map(([wallet, data]) => ({
          wallet,
          totalAmount: data.amount,
          tradeCount: data.count,
          percentage: totalYesStake > 0 ? (data.amount / totalYesStake) * 100 : 0,
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

      responseData.yesHolders = yesHoldersList;
      responseData.noHolders = noHoldersList;
      responseData.totalYesStake = totalYesStake;
      responseData.totalNoStake = totalNoStake;
      responseData.totalHolders = yesHoldersList.length + noHoldersList.length;
      responseData.uniqueHolders = new Set([
        ...yesHoldersList.map((h) => h.wallet),
        ...noHoldersList.map((h) => h.wallet),
      ]).size;
    }

    logger.info('Market activity processed', {
      marketId,
      totalTrades: votes.length,
      hasHistory: includeHistory,
      hasHolders: includeHolders,
    });

    return NextResponse.json(
      {
        success: true,
        data: responseData,
        source: isMainnet ? 'helius' : 'mongodb',
        network,
      },
      {
        headers: {
          // Cache for 5 seconds, serve stale for 15 seconds while revalidating
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
        },
      }
    );
  } catch (error) {
    logger.error('Failed to fetch market activity:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market activity',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
