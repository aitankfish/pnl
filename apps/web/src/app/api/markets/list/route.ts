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
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { apiError } from '@/lib/api-error';

// Disable Next.js caching for this route - data changes frequently
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

// The market list is IDENTICAL for every viewer on the same filter/page.
// A 30s Redis cache lets thousands of concurrent requests share one aggregation.
// Invalidation is natural via TTL (30s feels live enough for a browse list).
const LIST_CACHE_TTL_SECONDS = 30;

export async function GET(request: NextRequest) {
  try {
    // Public + Redis-cached, so the ceiling is generous — it only stops a flood
    // (e.g. an agent walking every market uncached), not normal browsing/CDN.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limited = await checkRateLimit(`markets-list:${ip}`, 600, 60_000);
    if (limited) return limited;

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    // Options: 'active', 'yesWins', 'noWins', 'expired', 'refund', 'all'

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    // Redis cache key — different filters and pages cache separately
    const cacheKey = prefixKey(`markets:list:${status}:p${page}:l${limit}`);
    const redis = (() => { try { return getRedisClient(); } catch { return null; } })();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return NextResponse.json(JSON.parse(cached), {
            headers: {
              'X-Cache': 'HIT',
              // Edge/CDN can also cache this since it's shared
              'Cache-Control': `public, s-maxage=${LIST_CACHE_TTL_SECONDS}, stale-while-revalidate=60`,
            },
          });
        }
      } catch (err) {
        logger.warn('[markets/list] redis read failed', { err });
      }
    }

    // Connect to MongoDB
    await connectToDatabase();

    // Build match query based on status filter
    let matchQuery: any = {};
    const now = new Date();

    if (status === 'active') {
      // Live/Active markets
      matchQuery = { marketState: 0 };
    } else if (status === 'yesWins') {
      // Markets where YES won (token launched)
      matchQuery = { resolution: 'YesWins' };
    } else if (status === 'noWins') {
      // Markets where NO won
      matchQuery = { resolution: 'NoWins' };
    } else if (status === 'expired') {
      // Markets that expired (past expiry time, still unresolved or active)
      matchQuery = {
        marketState: 0,
        expiryTime: { $lt: now }
      };
    } else if (status === 'refund') {
      // Refunded markets
      matchQuery = { resolution: 'Refund' };
    }
    // 'all' = no filter (show everything)

    // Get total count for pagination (before skip/limit)
    const totalCount = await PredictionMarket.countDocuments(matchQuery);

    // Use aggregation pipeline to fetch markets with project data and stake calculations in one query
    const marketsWithData = await PredictionMarket.aggregate([
      // Match markets based on status filter
      { $match: matchQuery },
      // Sort by creation date
      { $sort: { createdAt: -1 } },
      // Pagination
      { $skip: skip },
      { $limit: limit },
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

    // Calculate platform stats BEFORE hiding individual market data
    // These are aggregated totals that don't reveal individual market vote directions
    const platformStats = {
      totalVotes: marketsWithData.reduce((sum: number, m: any) => {
        return sum + (m.calculatedYesVotes || 0) + (m.calculatedNoVotes || 0);
      }, 0),
      totalPoolVolume: marketsWithData.reduce((sum: number, m: any) => {
        return sum + (m.calculatedYesStake || 0) + (m.calculatedNoStake || 0);
      }, 0),
      activeMarkets: marketsWithData.filter((m: any) =>
        !m.resolution || m.resolution === 'Unresolved'
      ).length,
      resolvedMarkets: marketsWithData.filter((m: any) =>
        m.resolution && m.resolution !== 'Unresolved'
      ).length,
    };

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
        galleryImageUrls: (project?.galleryImageUrls || []).map(convertToGatewayUrl).filter(Boolean),
        pitchVideoUrl: project?.pitchVideoUrl?.startsWith('http')
          ? project.pitchVideoUrl
          : convertToGatewayUrl(project?.pitchVideoUrl),

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

        // Timestamps
        createdAt: market.createdAt,

        // Favorites
        favoriteCount: market.favoriteCount || 0,

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

    // Pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const pagination = {
      page,
      limit,
      totalPages,
      totalCount,
      hasMore: page < totalPages,
    };

    logger.info('Fetched markets', {
      count: marketsWithProjects.length,
      page,
      totalCount,
      staleCount,
      syncHealthy,
    });

    const responseBody = {
      success: true,
      data: {
        markets: marketsWithProjects,
        total: marketsWithProjects.length,
        totalCount,
        pagination,
        syncHealth,
        platformStats, // Aggregated stats (doesn't reveal individual vote directions)
      },
    };

    // Write to Redis — next 30s of requests for this filter/page share this response
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(responseBody), 'EX', LIST_CACHE_TTL_SECONDS);
      } catch (err) {
        logger.warn('[markets/list] redis write failed', { err });
      }
    }

    return NextResponse.json(responseBody, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': `public, s-maxage=${LIST_CACHE_TTL_SECONDS}, stale-while-revalidate=60`,
      },
    });

  } catch (error) {
    logger.error('Failed to fetch markets:', error as any);
    return apiError('INTERNAL', 'Failed to fetch markets', {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
