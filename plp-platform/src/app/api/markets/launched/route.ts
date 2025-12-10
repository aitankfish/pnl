/**
 * API endpoint for fetching successfully launched tokens
 *
 * Returns markets that were resolved with YES outcome and have pump.fun tokens created
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket, Project } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { calculateVoteCountsForMarkets } from '@/lib/vote-counts';

const logger = createClientLogger();

// Helper function to convert IPFS URL to gateway URL
function convertToGatewayUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;

  const gatewayUrl = process.env.PINATA_GATEWAY_URL;
  if (!gatewayUrl) return imageUrl.startsWith('http') ? imageUrl : undefined;

  // If it's an IPFS URL (ipfs://...), convert to gateway URL
  if (imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    return `https://${gatewayUrl}/ipfs/${ipfsHash}`;
  }

  // If it's already a full URL, keep it as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }

  // If it's just a hash (bafyXXX or QmXXX), add gateway
  return `https://${gatewayUrl}/ipfs/${imageUrl}`;
}

export async function GET(_request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Fetch all resolved markets with YES outcome
    // Include both markets with token address AND recently resolved markets
    // (to catch edge cases where sync hasn't completed yet)
    const markets = await PredictionMarket.find({
      marketState: 1, // 1 = Resolved
      resolution: 'YesWins', // YES won the prediction
      $or: [
        { pumpFunTokenAddress: { $exists: true, $ne: null, $ne: '' } }, // Has token address
        { resolvedAt: { $gte: new Date(Date.now() - 60000) } }, // Resolved in last 60 seconds
      ]
    })
      .populate('projectId') // Populate project data
      .sort({ resolvedAt: -1 }) // Most recent launches first
      .lean();

    // Log warning for markets missing token address (shouldn't happen with immediate write)
    const missingToken = markets.filter(m => !m.pumpFunTokenAddress);
    if (missingToken.length > 0) {
      logger.warn('Found YesWins markets without token address', {
        count: missingToken.length,
        marketAddresses: missingToken.map(m => m.marketAddress),
      });
    }

    // Filter out markets without token address for final response
    const validMarkets = markets.filter(m => m.pumpFunTokenAddress);

    if (validMarkets.length === 0) {
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

    // Calculate vote counts from MongoDB for all valid markets
    const marketIds = validMarkets.map(m => m._id);
    const voteCountsMap = await calculateVoteCountsForMarkets(marketIds);

    // Transform data for frontend
    const launchedTokens = validMarkets.map((market) => {
      const project = market.projectId as any; // populated project

      // Get calculated vote counts (fallback to MongoDB fields if calculation failed)
      const voteCounts = voteCountsMap.get(market._id.toString()) || {
        yesVoteCount: market.yesVoteCount || 0,
        noVoteCount: market.noVoteCount || 0,
      };

      const totalVotes = voteCounts.yesVoteCount + voteCounts.noVoteCount;

      // Use sharesYesPercentage (from blockchain AMM) as single source of truth
      // This is consistent with browse page and reflects actual market outcome
      const yesPercentage = market.sharesYesPercentage ?? market.yesPercentage ?? 50;

      // Calculate pool amount raised - use poolBalance (actual SOL raised)
      // During prediction phase, poolBalance tracks SOL contributed
      // After launch, it may be 0 if all was used for token creation
      const poolBalanceNum = typeof market.poolBalance === 'string'
        ? parseInt(market.poolBalance, 10)
        : market.poolBalance || 0;
      const targetPoolNum = typeof market.targetPool === 'string'
        ? parseInt(market.targetPool, 10)
        : market.targetPool || 0;

      const poolRaised = poolBalanceNum > 0
        ? (poolBalanceNum / 1_000_000_000).toFixed(2) // Convert lamports to SOL
        : (targetPoolNum / 1_000_000_000).toFixed(2); // Fallback to target

      // Format category properly (first letter capital, handle special cases)
      const formatCategory = (cat: string): string => {
        if (!cat) return 'Other';
        const lowerCat = cat.toLowerCase();
        // Special cases
        const specialCases: { [key: string]: string } = {
          'dao': 'DAO',
          'nft': 'NFT',
          'ai': 'AI/ML',
          'defi': 'DeFi',
          'realestate': 'Real Estate',
        };
        if (specialCases[lowerCat]) return specialCases[lowerCat];
        // Capitalize first letter
        return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
      };

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
        yesVotes: voteCounts.yesVoteCount,
        noVotes: voteCounts.noVoteCount,
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
    logger.error('Failed to fetch launched tokens:', error);

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
