/**
 * API endpoint to fetch vote history for a specific market and user
 *
 * Returns all trades/votes made by a user on a specific market
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS } from '@/lib/database/models';
import { createClientLogger } from '@/lib/logger';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userWallet = searchParams.get('wallet');

    if (!userWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet address is required',
        },
        { status: 400 }
      );
    }

    const marketId = params.id;

    // Connect to database
    await connectToDatabase();
    const db = getDatabase();

    // Fetch all trades for this market and user
    const trades = await db.collection(COLLECTIONS.TRADE_HISTORY)
      .find({
        marketId,
        traderWallet: userWallet,
      })
      .sort({ createdAt: -1 }) // Most recent first
      .toArray();

    // Calculate totals
    let totalYesAmount = 0;
    let totalNoAmount = 0;
    let yesTradeCount = 0;
    let noTradeCount = 0;

    trades.forEach((trade) => {
      const amountInSol = trade.amount / 1_000_000_000;
      if (trade.voteType === 'yes') {
        totalYesAmount += amountInSol;
        yesTradeCount++;
      } else {
        totalNoAmount += amountInSol;
        noTradeCount++;
      }
    });

    const totalInvested = totalYesAmount + totalNoAmount;
    const totalTrades = yesTradeCount + noTradeCount;

    logger.info('Fetched vote history', {
      marketId,
      userWallet: userWallet.slice(0, 8) + '...',
      tradeCount: trades.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        trades: trades.map((trade) => ({
          voteType: trade.voteType,
          amount: trade.amount / 1_000_000_000, // Convert to SOL
          signature: trade.signature,
          timestamp: trade.createdAt,
        })),
        summary: {
          totalInvested,
          totalYesAmount,
          totalNoAmount,
          yesTradeCount,
          noTradeCount,
          totalTrades,
        },
      },
    });

  } catch (error) {
    logger.error('Failed to fetch vote history:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch vote history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
