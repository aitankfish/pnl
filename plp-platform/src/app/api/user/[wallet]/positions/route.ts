/**
 * API endpoint for fetching user's active positions
 *
 * Returns all markets where the user has an active position
 * Optimized with MongoDB aggregation pipeline for single-query data fetching
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS } from '@/lib/database/models';
import { createClientLogger } from '@/lib/logger';
import { convertToGatewayUrl } from '@/lib/api-utils';

const logger = createClientLogger();

interface UserPosition {
  marketId: string;
  marketName: string;
  marketAddress: string;
  voteType: 'yes' | 'no';
  totalAmount: number; // Total SOL staked
  totalShares: number; // Total shares held
  tradeCount: number; // Number of trades
  averagePrice: number; // Average price paid
  currentYesPrice: number;
  currentNoPrice: number;
  marketState: number;
  resolution?: string; // 'YesWins', 'NoWins', 'Refund', 'Unresolved'
  canClaim: boolean; // Can claim rewards (won and not yet claimed)
  isWinner: boolean; // Did the user win this position?
  claimed: boolean; // Has the user already claimed?
  expiryTime: Date;
  projectImageUrl?: string; // Add project image for display
  marketImage?: string; // Market/project image
  tokenSymbol?: string; // Token symbol for display
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    logger.info('Fetching user positions', { wallet });

    // Connect to database
    await connectToDatabase();
    const db = await getDatabase();

    // Use aggregation pipeline to fetch all position data in a single query
    const positionsAggregation = await db
      .collection(COLLECTIONS.TRADE_HISTORY)
      .aggregate([
        // Match trades for this wallet
        { $match: { traderWallet: wallet } },
        // Group by marketId and voteType to calculate totals
        {
          $group: {
            _id: { marketId: '$marketId', voteType: '$voteType' },
            totalAmount: { $sum: '$amount' },
            totalShares: { $sum: '$shares' },
            tradeCount: { $sum: 1 },
          },
        },
        // Lookup market details
        {
          $lookup: {
            from: COLLECTIONS.PREDICTION_MARKETS,
            localField: '_id.marketId',
            foreignField: '_id',
            as: 'market',
          },
        },
        { $unwind: { path: '$market', preserveNullAndEmptyArrays: false } },
        // Lookup project details
        {
          $lookup: {
            from: COLLECTIONS.PROJECTS,
            localField: 'market.projectId',
            foreignField: '_id',
            as: 'project',
          },
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        // Lookup participant data for claimed status
        {
          $lookup: {
            from: COLLECTIONS.PREDICTION_PARTICIPANTS,
            let: { marketId: '$_id.marketId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$marketId', '$$marketId'] },
                  participantWallet: wallet,
                },
              },
            ],
            as: 'participant',
          },
        },
        { $unwind: { path: '$participant', preserveNullAndEmptyArrays: true } },
        // Project the final shape
        {
          $project: {
            marketId: '$_id.marketId',
            voteType: '$_id.voteType',
            totalAmount: 1,
            totalShares: 1,
            tradeCount: 1,
            market: 1,
            project: 1,
            claimed: { $ifNull: ['$participant.claimed', false] },
          },
        },
      ])
      .toArray();

    // Transform aggregation results into positions
    const positions: UserPosition[] = positionsAggregation.map((pos: any) => {
      const market = pos.market;
      const project = pos.project;

      // Calculate current probability
      const totalYes = (market.totalYesStake || 0) / 1_000_000_000;
      const totalNo = (market.totalNoStake || 0) / 1_000_000_000;
      const total = totalYes + totalNo;
      const yesPrice = total > 0 ? (totalYes / total) * 100 : 50;
      const noPrice = 100 - yesPrice;

      const projectImageUrl = convertToGatewayUrl(project?.projectImageUrl);

      // Determine if user won based on resolution and their vote type
      const resolution = market.resolution || 'Unresolved';
      const isResolved = market.marketState === 1 || resolution !== 'Unresolved';

      const isWinner =
        (resolution === 'YesWins' && pos.voteType === 'yes') ||
        (resolution === 'NoWins' && pos.voteType === 'no') ||
        resolution === 'Refund';

      const canClaim = isResolved && isWinner && !pos.claimed;

      return {
        marketId: pos.marketId.toString(),
        marketName: market.marketName,
        marketAddress: market.marketAddress,
        voteType: pos.voteType,
        totalAmount: pos.totalAmount / 1_000_000_000,
        totalShares: pos.totalShares,
        tradeCount: pos.tradeCount,
        averagePrice: (pos.totalAmount / pos.totalShares / 1_000_000_000) * 100,
        currentYesPrice: yesPrice,
        currentNoPrice: noPrice,
        marketState: market.marketState,
        resolution,
        canClaim,
        isWinner,
        claimed: pos.claimed,
        expiryTime: market.expiryTime,
        projectImageUrl,
        marketImage: projectImageUrl,
        tokenSymbol: project?.tokenSymbol || market.tokenSymbol || 'TKN',
      };
    });

    // Separate active and resolved positions
    const activePositions = positions.filter((p) => p.marketState === 0);
    const resolvedPositions = positions.filter((p) => p.marketState === 1);
    const claimablePositions = positions.filter((p) => p.canClaim);

    logger.info('User positions fetched', {
      wallet,
      totalPositions: positions.length,
      activePositions: activePositions.length,
      resolvedPositions: resolvedPositions.length,
      claimablePositions: claimablePositions.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        all: positions,
        active: activePositions,
        resolved: resolvedPositions,
        claimable: claimablePositions,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch user positions:', error as any);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user positions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
