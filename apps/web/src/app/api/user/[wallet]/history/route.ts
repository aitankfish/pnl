/**
 * API endpoint for fetching user trading history
 *
 * Returns all trades made by a specific wallet address
 */

import { NextRequest, NextResponse } from 'next/server';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, TradeHistory, PredictionMarket } from '@/lib/database/models';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    logger.info('Fetching user trading history', { wallet });

    // Connect to database
    await connectToDatabase();
    const db = await getDatabase();

    // Fetch all trades for this wallet, sorted by most recent first
    const trades = await db
      .collection<TradeHistory>(COLLECTIONS.TRADE_HISTORY)
      .find({ traderWallet: wallet })
      .sort({ createdAt: -1 })
      .limit(50) // Limit to 50 most recent trades
      .toArray();

    // Fetch market details for each trade
    const marketIds = [...new Set(trades.map((t) => t.marketId))];
    const markets = await db
      .collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS)
      .find({ _id: { $in: marketIds } })
      .toArray();

    // Create a map of market data for quick lookup
    const marketMap = new Map(
      markets.map((m) => [m._id!.toString(), m])
    );

    // Enrich trades with market information
    const enrichedTrades = trades.map((trade) => {
      const market = marketMap.get(trade.marketId.toString());
      return {
        id: trade._id?.toString(),
        marketId: trade.marketId.toString(),
        marketName: market?.marketName || 'Unknown Market',
        marketAddress: trade.marketAddress,
        voteType: trade.voteType,
        amount: trade.amount / 1_000_000_000, // Convert to SOL
        shares: trade.shares,
        yesPrice: trade.yesPrice,
        noPrice: trade.noPrice,
        signature: trade.signature,
        timestamp: trade.createdAt,
        marketState: market?.marketState,
        winningOption: market?.winningOption,
      };
    });

    logger.info('User trading history fetched', {
      wallet,
      tradesCount: enrichedTrades.length,
    });

    return NextResponse.json({
      success: true,
      data: enrichedTrades,
    });
  } catch (error) {
    logger.error('Failed to fetch user trading history:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user trading history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
