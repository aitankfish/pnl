/**
 * API endpoint for listing active prediction markets
 *
 * This endpoint fetches all active markets from MongoDB
 * using aggregation pipeline for optimal performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import {
  isMarketDataStale,
  convertToGatewayUrl,
  getMarketDisplayStatus,
  getVoteButtonStates
} from '@/lib/api-utils';

// Disable Next.js caching for this route - data changes frequently
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(request: NextRequest) {
  try {
    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active'; // 'active', 'resolved', 'all'

    // Connect to MongoDB
    await connectToDatabase();

    // Build match query based on status filter
    let matchQuery: any = {};
    if (status === 'active') {
      matchQuery = { marketState: 0 };
    } else if (status === 'resolved') {
      matchQuery = { marketState: 1 };
    }
    // 'all' = no filter on marketState

    // Use aggregation pipeline to fetch markets with project data and stake calculations in one query
    const marketsWithData = await PredictionMarket.aggregate([
      // Match markets based on status filter
      { $match: matchQuery },
      // Sort by creation date
      { $sort: { createdAt: -1 } },
      // Limit results
      { $limit: 20 },
      // Join with projects collection
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project'
        }
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      // Join with participants to calculate stake totals
      {
        $lookup: {
          from: 'predictionparticipants',
          localField: '_id',
          foreignField: 'marketId',
          as: 'participants'
        }
      },
      // Calculate stake totals and vote counts
      {
        $addFields: {
          calculatedYesStake: {
            $divide: [
              { $sum: { $map: { input: '$participants', as: 'p', in: { $toLong: { $ifNull: ['$$p.yesShares', '0'] } } } } },
              1000000000
            ]
          },
          calculatedNoStake: {
            $divide: [
              { $sum: { $map: { input: '$participants', as: 'p', in: { $toLong: { $ifNull: ['$$p.noShares', '0'] } } } } },
              1000000000
            ]
          },
          calculatedYesVotes: {
            $size: { $filter: { input: '$participants', as: 'p', cond: { $gt: [{ $toLong: { $ifNull: ['$$p.yesShares', '0'] } }, 0] } } }
          },
          calculatedNoVotes: {
            $size: { $filter: { input: '$participants', as: 'p', cond: { $gt: [{ $toLong: { $ifNull: ['$$p.noShares', '0'] } }, 0] } } }
          }
        }
      },
      // Remove participants array from output (we only needed it for calculations)
      { $project: { participants: 0 } }
    ]);

    logger.debug('Aggregation completed', { marketCount: marketsWithData.length });

    // Transform aggregation results using shared utilities
    const marketsWithProjects = marketsWithData.map((market: any) => {
      const project = market.project;

      // Calculate time left
      const now = new Date();
      const expiryTime = new Date(market.expiryTime);
      const timeLeftMs = expiryTime.getTime() - now.getTime();
      const daysLeft = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      let timeLeft;
      if (daysLeft > 0) {
        timeLeft = `${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
      } else if (hoursLeft > 0) {
        timeLeft = `${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
      } else {
        timeLeft = 'Ending soon';
      }

      // Use sharesYesPercentage as single source of truth (from blockchain AMM)
      // Hide vote data for unresolved markets to prevent bandwagon voting
      const isUnresolved = !market.resolution || market.resolution === 'Unresolved';
      const yesPercentage = isUnresolved ? null : (market.sharesYesPercentage ?? market.yesPercentage ?? 50);
      const noPercentage = isUnresolved ? null : (yesPercentage !== null ? 100 - yesPercentage : null);

      // Use shared utilities for status calculation
      const statusInput = {
        resolution: market.resolution,
        phase: market.phase,
        poolProgressPercentage: market.poolProgressPercentage,
        expiryTime: market.expiryTime,
        tokenMint: market.tokenMint,
        pumpFunTokenAddress: market.pumpFunTokenAddress,
      };

      const { displayStatus, badgeClass } = getMarketDisplayStatus(statusInput);
      const voteStates = getVoteButtonStates(statusInput);

      return {
        id: market._id.toString(),
        marketAddress: market.marketAddress,
        name: project?.name || 'Unknown Project',
        description: project?.description || '',
        category: project?.category || 'Other',
        stage: project?.projectStage || 'Unknown',
        tokenSymbol: project?.tokenSymbol || 'TKN',
        targetPool: `${market.targetPool / 1e9} SOL`,
        // Hide vote counts for unresolved markets to prevent bandwagon voting
        yesVotes: isUnresolved ? null : (market.calculatedYesVotes || market.yesVoteCount || 0),
        noVotes: isUnresolved ? null : (market.calculatedNoVotes || market.noVoteCount || 0),
        totalYesStake: isUnresolved ? null : (market.calculatedYesStake || market.totalYesStake || 0),
        totalNoStake: isUnresolved ? null : (market.calculatedNoStake || market.totalNoStake || 0),
        yesPercentage,
        noPercentage,
        // Show total participants even for unresolved (doesn't reveal vote direction)
        totalParticipants: (market.calculatedYesVotes || 0) + (market.calculatedNoVotes || 0),
        timeLeft,
        expiryTime: market.expiryTime,
        status: market.resolution || (market.marketState === 0 ? 'active' : 'resolved'),
        metadataUri: market.metadataUri,
        projectImageUrl: convertToGatewayUrl(project?.projectImageUrl),

        // On-chain fields from blockchain sync
        // For resolved markets, use final values captured at resolution (before pool emptied by claims)
        resolution: market.resolution || 'Unresolved',
        phase: market.phase || 'Prediction',
        poolProgressPercentage: !isUnresolved && market.finalPoolProgressPercentage != null
          ? market.finalPoolProgressPercentage
          : (market.poolProgressPercentage || 0),
        poolBalance: !isUnresolved && market.finalPoolBalance != null
          ? market.finalPoolBalance
          : (market.poolBalance || 0),
        // Hide share counts for unresolved markets
        totalYesShares: isUnresolved ? null : (market.totalYesShares?.toString() || '0'),
        totalNoShares: isUnresolved ? null : (market.totalNoShares?.toString() || '0'),
        sharesYesPercentage: isUnresolved ? null : (market.sharesYesPercentage || 0),
        pumpFunTokenAddress: market.pumpFunTokenAddress || null,

        // Display status from shared utility
        displayStatus,
        badgeClass,

        // Vote button states from shared utility
        ...voteStates,

        // Sync status
        lastSyncedAt: market.lastSyncedAt || null,
        isStale: isMarketDataStale(market.lastSyncedAt),
        syncStatus: market.syncStatus || 'unknown',
      };
    });

    // Calculate overall sync health
    const staleCount = marketsWithProjects.filter((m: any) => m.isStale).length;
    const syncHealthy = staleCount === 0;
    const syncHealth = {
      healthy: syncHealthy,
      staleCount,
      totalCount: marketsWithProjects.length,
      message: syncHealthy
        ? 'All markets synced'
        : `${staleCount} market(s) may have stale data`,
    };

    logger.info('Fetched markets', {
      count: marketsWithProjects.length,
      staleCount,
      syncHealthy,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          markets: marketsWithProjects,
          total: marketsWithProjects.length,
          syncHealth,
        }
      },
      {
        headers: {
          // Reduced cache to 2 seconds for near real-time status updates
          // Markets can change status frequently (voting, expiry, resolution)
          'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=5',
        },
      }
    );

  } catch (error) {
    logger.error('Failed to fetch markets:', error as any);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch markets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
