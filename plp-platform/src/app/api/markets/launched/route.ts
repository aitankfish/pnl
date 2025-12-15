/**
 * API endpoint for fetching successfully launched tokens
 *
 * Returns markets that were resolved with YES outcome and have pump.fun tokens created
 * Optimized with MongoDB aggregation pipeline for single-query data fetching
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { convertToGatewayUrl } from '@/lib/api-utils';

const logger = createClientLogger();

export async function GET(_request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Use aggregation pipeline to fetch markets + projects + stake calculations in one query
    const marketsWithData = await PredictionMarket.aggregate([
      // Match resolved YesWins markets with token address
      {
        $match: {
          marketState: 1, // 1 = Resolved
          resolution: 'YesWins', // YES won the prediction
          pumpFunTokenAddress: { $exists: true, $nin: [null, ''] },
        }
      },
      // Sort by resolution date (most recent first)
      { $sort: { resolvedAt: -1 } },
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
      // Join with participants to calculate stake totals and vote counts
      {
        $lookup: {
          from: 'predictionparticipants',
          localField: '_id',
          foreignField: 'marketId',
          as: 'participants'
        }
      },
      // Calculate stake totals and vote counts from participants
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

    logger.debug('Launched markets aggregation completed', { count: marketsWithData.length });

    if (marketsWithData.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            launched: [],
            total: 0,
          }
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    // Format category properly (first letter capital, handle special cases)
    const formatCategory = (cat: string): string => {
      if (!cat) return 'Other';
      const lowerCat = cat.toLowerCase();
      const specialCases: { [key: string]: string } = {
        'dao': 'DAO',
        'nft': 'NFT',
        'ai': 'AI/ML',
        'defi': 'DeFi',
        'realestate': 'Real Estate',
      };
      if (specialCases[lowerCat]) return specialCases[lowerCat];
      return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
    };

    // Transform aggregation results for frontend
    const launchedTokens = marketsWithData.map((market: any) => {
      const project = market.project;

      // Use calculated values from aggregation, fallback to market fields
      const yesVotes = market.calculatedYesVotes || market.yesVoteCount || 0;
      const noVotes = market.calculatedNoVotes || market.noVoteCount || 0;
      const totalVotes = yesVotes + noVotes;

      // Use sharesYesPercentage (from blockchain AMM) as single source of truth
      const yesPercentage = market.sharesYesPercentage ?? market.yesPercentage ?? 50;

      // Get calculated stake totals from aggregation
      let totalRaised = (market.calculatedYesStake || 0) + (market.calculatedNoStake || 0);

      // If aggregation calculation is too low, use market's blockchain-synced stake values
      const marketYesStake = (market.totalYesStake || 0) / 1_000_000_000;
      const marketNoStake = (market.totalNoStake || 0) / 1_000_000_000;
      const marketTotalStake = marketYesStake + marketNoStake;

      if (marketTotalStake > totalRaised) {
        totalRaised = marketTotalStake;
      }

      const poolRaised = totalRaised > 0 ? totalRaised.toFixed(2) : '0.00';

      // Truncate description to 150 characters
      const description = project?.description || '';
      const truncatedDescription = description.length > 150
        ? description.substring(0, 150) + '...'
        : description;

      return {
        id: market._id.toString(),
        marketAddress: market.marketAddress,
        name: project?.name || 'Unknown Project',
        symbol: project?.tokenSymbol || 'TKN',
        description: truncatedDescription,
        category: formatCategory(project?.category || 'Other'),
        launchDate: market.resolvedAt ? new Date(market.resolvedAt).toISOString().split('T')[0] : 'Unknown',
        tokenAddress: market.pumpFunTokenAddress,
        projectImageUrl: convertToGatewayUrl(project?.projectImageUrl),

        // Vote statistics
        totalVotes,
        yesVotes,
        noVotes,
        yesPercentage,

        // Pool information
        launchPool: `${poolRaised} SOL`,
        targetPool: market.targetPool,

        // Social links
        website: project?.website || null,
        twitter: project?.twitter || null,
        telegram: project?.telegram || null,
        discord: project?.discord || null,
      };
    });

    logger.info('Fetched launched tokens', { count: launchedTokens.length });

    return NextResponse.json(
      {
        success: true,
        data: {
          launched: launchedTokens,
          total: launchedTokens.length,
        }
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );

  } catch (error) {
    logger.error('Failed to fetch launched tokens:', error as any);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch launched tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
