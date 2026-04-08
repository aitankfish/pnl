/**
 * API endpoint for fetching user statistics
 *
 * Returns aggregated stats for a specific wallet address
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import {
  COLLECTIONS,
  TradeHistory,
  PredictionMarket,
  Project,
  UserProfile,
} from '@/lib/database/models';
import { createClientLogger } from '@/lib/logger';
import { ObjectId } from 'mongodb';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    logger.info('Fetching user stats', { wallet });

    // Connect to database
    await connectToDatabase();
    const db = await getDatabase();

    // Fetch user profile (if exists)
    const userProfile = await db
      .collection<UserProfile>(COLLECTIONS.USER_PROFILES)
      .findOne({ walletAddress: wallet });

    // Fetch all trades by this user
    const trades = await db
      .collection<TradeHistory>(COLLECTIONS.TRADE_HISTORY)
      .find({ traderWallet: wallet })
      .toArray();

    // Fetch all projects created by this user
    const projects = await db
      .collection<Project>(COLLECTIONS.PROJECTS)
      .find({ founderWallet: wallet })
      .toArray();

    // Group trades by market to calculate positions
    const marketTrades = new Map<string, { yes: number; no: number }>();
    trades.forEach((trade) => {
      const marketId = trade.marketId.toString();
      const existing = marketTrades.get(marketId) || { yes: 0, no: 0 };

      if (trade.voteType === 'yes') {
        existing.yes += trade.amount;
      } else {
        existing.no += trade.amount;
      }

      marketTrades.set(marketId, existing);
    });

    // Fetch market details to check outcomes
    const marketIds = Array.from(marketTrades.keys()).map((id) => new ObjectId(id));
    const markets = await db
      .collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS)
      .find({ _id: { $in: marketIds } })
      .toArray();

    // Calculate success rate
    let totalVotes = 0;
    let successfulVotes = 0;
    let totalSOLStaked = 0;

    markets.forEach((market) => {
      const marketId = market._id!.toString();
      const position = marketTrades.get(marketId);

      if (!position) return;

      // Count this as a vote
      totalVotes++;

      // Calculate SOL staked
      totalSOLStaked += (position.yes + position.no) / 1_000_000_000;

      // Check if this was a successful prediction
      if (market.marketState === 1 && market.winningOption !== undefined) {
        // Market is resolved
        const userVotedYes = position.yes > 0;
        const userVotedNo = position.no > 0;

        // If user only voted on the winning side, count as success
        if (market.winningOption && userVotedYes && !userVotedNo) {
          successfulVotes++;
        } else if (!market.winningOption && userVotedNo && !userVotedYes) {
          successfulVotes++;
        }
      }
    });

    // Calculate project success rate
    const completedProjects = projects.filter((p) => p.status === 'completed');
    const successfulProjects = completedProjects.length;

    // Calculate reputation score (simple formula for now)
    const reputationScore =
      userProfile?.reputationScore ||
      Math.round(
        successfulVotes * 10 +
          successfulProjects * 50 +
          Math.min(totalVotes, 100) * 5
      );

    // Get join date
    const joinedDate =
      userProfile?.createdAt ||
      (trades.length > 0
        ? trades.reduce((min, t) => (t.createdAt < min ? t.createdAt : min), trades[0].createdAt)
        : projects.length > 0
          ? projects.reduce((min, p) => (p.createdAt < min ? p.createdAt : min), projects[0].createdAt)
          : new Date());

    const stats = {
      projectsCreated: projects.length,
      totalVotes,
      successfulPredictions: successfulVotes,
      totalSOLStaked,
      successRate: totalVotes > 0 ? Math.round((successfulVotes / totalVotes) * 100) : 0,
      reputation: reputationScore,
      joinedDate,
      successfulProjects,
      activePositions: markets.filter((m) => m.marketState === 0).length,
      resolvedPositions: markets.filter((m) => m.marketState === 1).length,
      totalTrades: trades.length,
    };

    logger.info('User stats calculated', {
      wallet,
      stats,
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to fetch user stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
