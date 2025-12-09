/**
 * API endpoint for listing active prediction markets
 *
 * This endpoint fetches all active markets from MongoDB
 * and returns them with their associated project data
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket, PredictionParticipant, Project } from '@/lib/mongodb';
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

    // Fetch all active markets with their projects in a single query using populate
    const markets = await PredictionMarket.find({ marketState: 0 }) // 0 = Active
      .populate('projectId') // Populate project data in one query
      .sort({ createdAt: -1 }) // Most recent first
      .limit(20) // Limit to 20 markets for faster initial load
      .lean();

    // Calculate vote counts from MongoDB for all markets
    const marketIds = markets.map(m => m._id);
    const voteCountsMap = await calculateVoteCountsForMarkets(marketIds);

    // Calculate stake totals from participants for all markets (fresh data, not stale MongoDB fields)
    const participants = await PredictionParticipant.find({
      marketId: { $in: marketIds }
    }).lean();

    // Build map of stake totals per market
    const stakeTotalsMap = new Map<string, { totalYesStake: number; totalNoStake: number }>();

    // Initialize all markets with 0 stakes
    for (const marketId of marketIds) {
      stakeTotalsMap.set(marketId.toString(), { totalYesStake: 0, totalNoStake: 0 });
    }

    // Calculate stakes from participants
    for (const participant of participants) {
      const marketIdStr = participant.marketId.toString();
      const stakes = stakeTotalsMap.get(marketIdStr) || { totalYesStake: 0, totalNoStake: 0 };

      const yesShares = BigInt(participant.yesShares || '0');
      const noShares = BigInt(participant.noShares || '0');

      // Convert from lamports to SOL
      stakes.totalYesStake += Number(yesShares) / 1_000_000_000;
      stakes.totalNoStake += Number(noShares) / 1_000_000_000;

      stakeTotalsMap.set(marketIdStr, stakes);
    }

    logger.info('Calculated stake totals for all markets', {
      marketCount: marketIds.length,
      participantCount: participants.length
    });

    // Combine market and project data
    const marketsWithProjects = markets.map((market) => {
      const project = market.projectId as any; // populated project

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

      // Get calculated vote counts (fallback to MongoDB fields if calculation failed)
      const voteCounts = voteCountsMap.get(market._id.toString()) || {
        yesVoteCount: market.yesVoteCount || 0,
        noVoteCount: market.noVoteCount || 0,
      };

      // Get calculated stake totals (fallback to MongoDB fields if calculation failed)
      const stakeTotals = stakeTotalsMap.get(market._id.toString()) || {
        totalYesStake: market.totalYesStake || 0,
        totalNoStake: market.totalNoStake || 0,
      };

      // Use sharesYesPercentage as single source of truth (from blockchain AMM)
      // This is calculated from on-chain totalYesShares / (totalYesShares + totalNoShares)
      const yesPercentage = market.sharesYesPercentage ?? market.yesPercentage ?? 50;
      const noPercentage = 100 - yesPercentage;

      // Calculate display status (single source of truth for all pages)
      const resolution = market.resolution || 'Unresolved';
      const phase = market.phase || 'Prediction';
      const poolProgressPercentage = market.poolProgressPercentage || 0;
      const isExpired = now.getTime() > expiryTime.getTime();
      const hasTokenLaunched = !!(market.tokenMint || market.pumpFunTokenAddress); // Check if token was launched

      let displayStatus = '✅ Active';
      let badgeClass = 'bg-green-500/20 text-green-300 border-green-400/30';

      // Resolved states
      if (resolution === 'YesWins') {
        // Check if token has been launched
        if (hasTokenLaunched) {
          displayStatus = '🚀 Token Launched';
          badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30';
        } else if (phase === 1) { // 1 = Funding phase (extended)
          displayStatus = '💰 Funding Phase';
          badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-400/30';
        } else {
          // YES won but not launched yet
          displayStatus = '🎉 YES Wins';
          badgeClass = 'bg-green-500/20 text-green-300 border-green-400/30';
        }
      } else if (resolution === 'NoWins') {
        displayStatus = '❌ NO Wins';
        badgeClass = 'bg-red-500/20 text-red-300 border-red-400/30';
      } else if (resolution === 'Refund') {
        displayStatus = '↩️ Refund';
        badgeClass = 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      } else if (resolution === 'Unresolved') {
        // Unresolved - check various states
        if (isExpired) {
          displayStatus = '⏳ Awaiting Resolution';
          badgeClass = 'bg-orange-500/20 text-orange-300 border-orange-400/30';
        } else if (phase === 1) { // 1 = Funding
          displayStatus = '💰 Funding Phase';
          badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-400/30';
        } else if (poolProgressPercentage >= 100) {
          displayStatus = '🎯 Pool Complete';
          badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30';
        }
      }

      // Calculate vote button states (single source of truth)
      let isYesVoteEnabled = true;
      let isNoVoteEnabled = true;
      let yesVoteDisabledReason = '';
      let noVoteDisabledReason = '';

      if (hasTokenLaunched) {
        // Token launched - all voting disabled
        isYesVoteEnabled = false;
        isNoVoteEnabled = false;
        yesVoteDisabledReason = '🚀 Token Launched';
        noVoteDisabledReason = '🚀 Token Launched';
      } else if (isExpired) {
        // Market expired - all voting disabled
        isYesVoteEnabled = false;
        isNoVoteEnabled = false;
        yesVoteDisabledReason = '⏰ Market Expired';
        noVoteDisabledReason = '⏰ Market Expired';
      } else if (resolution === 'NoWins') {
        // NO won - both disabled
        isYesVoteEnabled = false;
        isNoVoteEnabled = false;
        yesVoteDisabledReason = 'NO Won';
        noVoteDisabledReason = 'NO Won';
      } else if (resolution === 'Refund') {
        // Refunded - both disabled
        isYesVoteEnabled = false;
        isNoVoteEnabled = false;
        yesVoteDisabledReason = 'Refunded';
        noVoteDisabledReason = 'Refunded';
      } else if (resolution === 'YesWins') {
        // YES won - check if extended to Funding
        if (phase === 0) { // 0 = Prediction
          // Not extended yet - both disabled
          isYesVoteEnabled = false;
          isNoVoteEnabled = false;
          yesVoteDisabledReason = 'Awaiting Extension';
          noVoteDisabledReason = 'Awaiting Extension';
        } else if (phase === 1) { // 1 = Funding
          // Extended - YES enabled, NO disabled
          isYesVoteEnabled = true;
          isNoVoteEnabled = false;
          noVoteDisabledReason = 'YES Locked';
        }
      } else if (resolution === 'Unresolved') {
        // Unresolved - check phase and pool
        if (phase === 1) { // 1 = Funding
          // Funding phase - YES enabled, NO disabled
          isYesVoteEnabled = true;
          isNoVoteEnabled = false;
          noVoteDisabledReason = 'YES Locked';
        } else if (phase === 0) { // 0 = Prediction
          // Prediction phase - check pool
          if (poolProgressPercentage >= 100) {
            // Pool full - both disabled
            isYesVoteEnabled = false;
            isNoVoteEnabled = false;
            yesVoteDisabledReason = 'Pool Complete';
            noVoteDisabledReason = 'Pool Complete';
          }
          // Otherwise both enabled (default)
        }
      }

      return {
        id: market._id.toString(),
        marketAddress: market.marketAddress,
        name: project?.name || 'Unknown Project',
        description: project?.description || '',
        category: project?.category || 'Other',
        stage: project?.projectStage || 'Unknown',
        tokenSymbol: project?.tokenSymbol || 'TKN',
        targetPool: `${market.targetPool / 1e9} SOL`,
        yesVotes: voteCounts.yesVoteCount,
        noVotes: voteCounts.noVoteCount,
        totalYesStake: stakeTotals.totalYesStake,
        totalNoStake: stakeTotals.totalNoStake,
        yesPercentage, // Add calculated percentage
        noPercentage, // Add calculated percentage
        timeLeft,
        expiryTime: market.expiryTime,
        status: market.resolution || (market.marketState === 0 ? 'active' : 'resolved'),
        metadataUri: market.metadataUri,
        projectImageUrl: convertToGatewayUrl(project?.projectImageUrl),

        // On-chain fields from blockchain sync (MongoDB has fresh data via WebSocket)
        resolution: market.resolution || 'Unresolved',
        phase: market.phase || 'Prediction',
        poolProgressPercentage: market.poolProgressPercentage || 0,
        poolBalance: market.poolBalance || 0,
        totalYesShares: market.totalYesShares?.toString() || '0',
        totalNoShares: market.totalNoShares?.toString() || '0',
        sharesYesPercentage: market.sharesYesPercentage || 0,
        pumpFunTokenAddress: market.pumpFunTokenAddress || null,

        // Display status (calculated once in API, used by all pages)
        displayStatus,
        badgeClass,

        // Vote button states (calculated once in API, used by all pages)
        isYesVoteEnabled,
        isNoVoteEnabled,
        yesVoteDisabledReason,
        noVoteDisabledReason,
      };
    });

    logger.info('Fetched markets', { count: marketsWithProjects.length });

    return NextResponse.json(
      {
        success: true,
        data: {
          markets: marketsWithProjects,
          total: marketsWithProjects.length,
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
    logger.error('Failed to fetch markets:', error);

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
