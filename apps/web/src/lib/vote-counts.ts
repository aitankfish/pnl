/**
 * Vote Count Calculation Utilities
 *
 * Calculates vote counts from MongoDB data as a fallback
 * to real-time WebSocket updates
 */

import { connectToDatabase, PredictionParticipant, PredictionMarket } from '@/lib/mongodb';
import type { Types } from 'mongoose';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export interface VoteCounts {
  yesVoteCount: number;
  noVoteCount: number;
}

/**
 * Calculate vote counts for a single market from prediction_participants collection
 */
export async function calculateVoteCounts(marketId: string | Types.ObjectId): Promise<VoteCounts> {
  try {
    await connectToDatabase();

    // Get all participants for this market
    const participants = await PredictionParticipant.find({ marketId }).lean();

    let yesVoteCount = 0;
    let noVoteCount = 0;

    // Count voters based on their shares
    for (const participant of participants) {
      const yesShares = BigInt(participant.yesShares || '0');
      const noShares = BigInt(participant.noShares || '0');

      // A voter has YES shares if yesShares > 0
      if (yesShares > BigInt(0)) {
        yesVoteCount++;
      }
      // A voter has NO shares if noShares > 0
      else if (noShares > BigInt(0)) {
        noVoteCount++;
      }
    }

    logger.info('Calculated vote counts from MongoDB', {
      marketId: marketId.toString(),
      yesVoteCount,
      noVoteCount,
      totalParticipants: participants.length
    });

    return { yesVoteCount, noVoteCount };
  } catch (error) {
    logger.error('Failed to calculate vote counts:', error);
    return { yesVoteCount: 0, noVoteCount: 0 };
  }
}

/**
 * Calculate and update vote counts for a market in the database
 */
export async function updateMarketVoteCounts(marketId: string | Types.ObjectId): Promise<VoteCounts> {
  try {
    const counts = await calculateVoteCounts(marketId);

    await connectToDatabase();

    // Update the market document with calculated counts
    await PredictionMarket.updateOne(
      { _id: marketId },
      {
        $set: {
          yesVoteCount: counts.yesVoteCount,
          noVoteCount: counts.noVoteCount,
          voteCountsUpdatedAt: new Date(),
        }
      }
    );

    logger.info('Updated market vote counts in MongoDB', {
      marketId: marketId.toString(),
      ...counts
    });

    return counts;
  } catch (error) {
    logger.error('Failed to update market vote counts:', error);
    throw error;
  }
}

/**
 * Calculate vote counts for multiple markets (for list endpoints)
 */
export async function calculateVoteCountsForMarkets(
  marketIds: (string | Types.ObjectId)[]
): Promise<Map<string, VoteCounts>> {
  try {
    await connectToDatabase();

    // Get all participants for these markets in one query
    const participants = await PredictionParticipant.find({
      marketId: { $in: marketIds }
    }).lean();

    // Group by market and count
    const countsMap = new Map<string, VoteCounts>();

    // Initialize all markets with 0 counts
    for (const marketId of marketIds) {
      countsMap.set(marketId.toString(), { yesVoteCount: 0, noVoteCount: 0 });
    }

    // Count votes for each market
    for (const participant of participants) {
      const marketIdStr = participant.marketId.toString();
      const counts = countsMap.get(marketIdStr) || { yesVoteCount: 0, noVoteCount: 0 };

      const yesShares = BigInt(participant.yesShares || '0');
      const noShares = BigInt(participant.noShares || '0');

      if (yesShares > BigInt(0)) {
        counts.yesVoteCount++;
      } else if (noShares > BigInt(0)) {
        counts.noVoteCount++;
      }

      countsMap.set(marketIdStr, counts);
    }

    logger.info('Calculated vote counts for multiple markets', {
      marketCount: marketIds.length,
      totalParticipants: participants.length
    });

    return countsMap;
  } catch (error) {
    logger.error('Failed to calculate vote counts for markets:', error);
    return new Map();
  }
}
