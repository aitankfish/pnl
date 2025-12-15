/**
 * API endpoint for fetching individual market details
 *
 * This endpoint fetches a specific market by ID from MongoDB
 * and includes associated project data and IPFS metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket, PredictionParticipant } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { calculateVoteCounts } from '@/lib/vote-counts';
import { isMarketDataStale, formatProjectAge, truncateWallet } from '@/lib/api-utils';

// Disable Next.js caching for this route - market data changes frequently
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Connect to MongoDB
    await connectToDatabase();

    // Use aggregation pipeline to fetch market + project + founder profile in a single query
    const mongoose = await import('mongoose');
    const marketAggregation = await PredictionMarket.aggregate([
      // Match the market by ID
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      // Join with project collection
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project'
        }
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: false } },
      // Join with user_profiles to get founder username
      {
        $lookup: {
          from: 'user_profiles',
          localField: 'project.founderWallet',
          foreignField: 'walletAddress',
          as: 'founderProfile'
        }
      },
      { $unwind: { path: '$founderProfile', preserveNullAndEmptyArrays: true } },
      // Project fields we need
      {
        $addFields: {
          founderUsername: '$founderProfile.username',
          founderWallet: '$project.founderWallet'
        }
      }
    ]);

    if (!marketAggregation || marketAggregation.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    const marketWithRelations = marketAggregation[0];
    const market = marketWithRelations;
    const project = marketWithRelations.project;
    const founderUsername = marketWithRelations.founderUsername || null;
    const founderWallet = marketWithRelations.founderWallet;

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Associated project not found' },
        { status: 404 }
      );
    }

    // Calculate project age from market creation date
    const projectAge = formatProjectAge(market.createdAt);

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

    // Convert IPFS URL to gateway URL if needed
    let imageUrl = project?.projectImageUrl;
    if (imageUrl && process.env.PINATA_GATEWAY_URL) {
      const gatewayUrl = process.env.PINATA_GATEWAY_URL;

      if (imageUrl.startsWith('ipfs://')) {
        const ipfsHash = imageUrl.replace('ipfs://', '');
        imageUrl = `https://${gatewayUrl}/ipfs/${ipfsHash}`;
      } else if (!imageUrl.startsWith('http')) {
        imageUrl = `https://${gatewayUrl}/ipfs/${imageUrl}`;
      }
    } else if (imageUrl && !imageUrl.startsWith('http')) {
      logger.warn('PINATA_GATEWAY_URL not configured, cannot convert IPFS hash to URL', { imageUrl });
      imageUrl = undefined;
    }

    // Convert document URLs to gateway URLs
    let documentUrls: string[] = [];
    if (project?.documentUrls && project.documentUrls.length > 0 && process.env.PINATA_GATEWAY_URL) {
      const gatewayUrl = process.env.PINATA_GATEWAY_URL;
      documentUrls = project.documentUrls.map((docUrl: string) => {
        if (docUrl.startsWith('ipfs://')) {
          const ipfsHash = docUrl.replace('ipfs://', '');
          return `https://${gatewayUrl}/ipfs/${ipfsHash}`;
        } else if (!docUrl.startsWith('http')) {
          return `https://${gatewayUrl}/ipfs/${docUrl}`;
        }
        return docUrl;
      });
    }

    // Run vote counts and participant stake calculations in parallel
    const [voteCounts, stakeResult] = await Promise.all([
      calculateVoteCounts(market._id),
      // Calculate total stakes from participants using aggregation
      PredictionParticipant.aggregate([
        { $match: { marketId: market._id } },
        {
          $group: {
            _id: null,
            totalYesShares: { $sum: { $toLong: { $ifNull: ['$yesShares', '0'] } } },
            totalNoShares: { $sum: { $toLong: { $ifNull: ['$noShares', '0'] } } },
            participantCount: { $sum: 1 }
          }
        }
      ])
    ]);

    // Extract stake totals from aggregation result
    let totalYesStake = 0;
    let totalNoStake = 0;
    if (stakeResult && stakeResult.length > 0) {
      const result = stakeResult[0];
      totalYesStake = Number(result.totalYesShares || 0) / 1_000_000_000;
      totalNoStake = Number(result.totalNoShares || 0) / 1_000_000_000;
      logger.debug('Calculated stake totals', {
        marketId: market._id.toString(),
        totalYesStake,
        totalNoStake,
        participantCount: result.participantCount
      });
    } else {
      // Fallback to MongoDB fields if aggregation returns empty
      totalYesStake = market.totalYesStake || 0;
      totalNoStake = market.totalNoStake || 0;
    }

    // Get metadata - use cached version if available, otherwise fetch from IPFS
    let metadata = null;
    const METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

    // Check if we have valid cached metadata
    const hasCachedMetadata = market.cachedMetadata && market.metadataCachedAt;
    const cacheAge = hasCachedMetadata && market.metadataCachedAt
      ? Date.now() - new Date(market.metadataCachedAt).getTime()
      : Infinity;
    const isCacheValid = cacheAge < METADATA_CACHE_TTL_MS;

    if (hasCachedMetadata && isCacheValid) {
      // Use cached metadata
      metadata = market.cachedMetadata;
      logger.debug('Using cached metadata', { marketId: id, cacheAge: Math.floor(cacheAge / 1000) + 's' });
    } else if (market.metadataUri) {
      // Fetch from IPFS and cache
      try {
        let metadataUrl = market.metadataUri;

        // Convert IPFS URI to gateway URL
        if (metadataUrl.startsWith('ipfs://') && process.env.PINATA_GATEWAY_URL) {
          const ipfsHash = metadataUrl.replace('ipfs://', '');
          metadataUrl = `https://${process.env.PINATA_GATEWAY_URL}/ipfs/${ipfsHash}`;
        }

        logger.info('Fetching metadata from IPFS', { metadataUrl });

        const metadataResponse = await fetch(metadataUrl, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (metadataResponse.ok) {
          metadata = await metadataResponse.json();
          logger.info('Successfully fetched metadata from IPFS', { marketId: id });

          // Cache metadata in MongoDB (fire and forget - don't block response)
          PredictionMarket.updateOne(
            { _id: market._id },
            {
              $set: {
                cachedMetadata: metadata,
                metadataCachedAt: new Date()
              }
            }
          ).exec().catch(err => {
            logger.warn('Failed to cache metadata', { error: err.message });
          });
        } else {
          logger.warn('Failed to fetch metadata', {
            status: metadataResponse.status,
            statusText: metadataResponse.statusText
          });
        }
      } catch (error) {
        logger.error('Error fetching metadata from IPFS:', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Calculate display status and vote button states (single source of truth)
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

    const marketDetails = {
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
      totalYesStake: totalYesStake,
      totalNoStake: totalNoStake,
      timeLeft,
      expiryTime: market.expiryTime,
      status: market.marketState === 0 ? 'active' : 'resolved',
      metadataUri: market.metadataUri,
      projectImageUrl: imageUrl,
      documentUrls,
      metadata,

      // On-chain fields from blockchain sync (MongoDB has fresh data via WebSocket)
      poolBalance: market.poolBalance,
      yesPool: market.yesPool,
      noPool: market.noPool,
      totalYesShares: market.totalYesShares,
      totalNoShares: market.totalNoShares,
      poolProgressPercentage: market.poolProgressPercentage,
      // Use sharesYesPercentage as single source of truth (from blockchain AMM)
      // This matches browse page API and ensures consistency
      yesPercentage: market.sharesYesPercentage ?? market.yesPercentage ?? 50,
      noPercentage: market.sharesYesPercentage ? 100 - market.sharesYesPercentage : (market.yesPercentage ? 100 - market.yesPercentage : 50),
      sharesYesPercentage: market.sharesYesPercentage,
      phase: market.phase,
      resolution: market.resolution,
      tokenMint: market.tokenMint,
      pumpFunTokenAddress: market.pumpFunTokenAddress,
      platformTokensAllocated: market.platformTokensAllocated,
      platformTokensClaimed: market.platformTokensClaimed,
      yesVoterTokensAllocated: market.yesVoterTokensAllocated,
      availableActions: market.availableActions,
      lastSyncedAt: market.lastSyncedAt,
      syncStatus: market.syncStatus,
      isStale: isMarketDataStale(market.lastSyncedAt),

      // Project owner and age
      founderWallet,
      founderUsername,
      founderDisplayName: founderUsername || truncateWallet(founderWallet),
      projectAge,

      // Display status (calculated once in API, used by all pages)
      displayStatus,
      badgeClass,

      // Vote button states (calculated once in API, used by all pages)
      isYesVoteEnabled,
      isNoVoteEnabled,
      yesVoteDisabledReason,
      noVoteDisabledReason,
    };

    logger.info('Fetched market details', { marketId: id });

    return NextResponse.json(
      {
        success: true,
        data: marketDetails,
      },
      {
        headers: {
          // Reduced cache to 2 seconds for near real-time status updates
          // Markets can change status frequently (voting, expiry, resolution, token launch)
          'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=5',
        },
      }
    );

  } catch (error) {
    logger.error('Failed to fetch market details:', error as any);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
