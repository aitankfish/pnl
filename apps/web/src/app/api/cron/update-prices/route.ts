/**
 * Cron Job: Update All Token Prices
 *
 * Runs every minute to fetch prices for ALL launched tokens using Birdeye's
 * token_overview API. This ensures:
 * - All users get instant cached prices (no cold cache)
 * - Scalable with rate-limited individual requests
 *
 * Trigger: Render Cron or Upstash QStash
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const REDIS_KEY_PREFIX = 'token-stats:';
const CACHE_TTL_SECONDS = 120; // 2 minutes (cron runs every 1 min, so always fresh)
const RATE_LIMIT_DELAY_MS = 100; // 100ms between API calls (10 requests/sec)

interface TokenStats {
  address: string;
  price: number | null;
  priceChange24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  holders: number | null;
  liquidity: number | null;
  updatedAt: number;
}

/**
 * Fetch stats for a single token from Birdeye
 */
async function fetchSingleTokenStats(address: string): Promise<TokenStats> {
  const birdeyeApiKey = process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;

  const emptyStats: TokenStats = {
    address,
    price: null,
    priceChange24h: null,
    marketCap: null,
    volume24h: null,
    holders: null,
    liquidity: null,
    updatedAt: Date.now(),
  };

  if (!birdeyeApiKey) return emptyStats;

  try {
    const response = await fetch(
      `https://public-api.birdeye.so/defi/token_overview?address=${address}`,
      {
        headers: {
          'X-API-KEY': birdeyeApiKey,
          'x-chain': 'solana',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Invalid Birdeye response');
    }

    return {
      address,
      price: data.data.price || null,
      priceChange24h: data.data.priceChange24hPercent || null,
      marketCap: data.data.mc || null,
      volume24h: data.data.v24hUSD || null,
      holders: data.data.holder || null,
      liquidity: data.data.liquidity || null,
      updatedAt: Date.now(),
    };
  } catch (error) {
    logger.error(`Error fetching stats for ${address}:`, { error });
    return emptyStats;
  }
}


/**
 * Store multiple token stats in Redis using pipeline
 */
async function storeAllStats(statsMap: Map<string, TokenStats>): Promise<void> {
  const redis = getRedisClient();
  const pipeline = redis.pipeline();

  for (const [address, stats] of statsMap) {
    const key = prefixKey(`${REDIS_KEY_PREFIX}${address}`);
    pipeline.setex(key, CACHE_TTL_SECONDS, JSON.stringify(stats));
  }

  await pipeline.exec();
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without auth in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Get all launched tokens with their token addresses
    const launchedMarkets = await PredictionMarket.find({
      marketState: 1, // Resolved
      resolution: 'YesWins',
      pumpFunTokenAddress: { $exists: true, $nin: [null, ''] },
    }).select('pumpFunTokenAddress').lean();

    const tokenAddresses = launchedMarkets
      .map((m: any) => m.pumpFunTokenAddress)
      .filter(Boolean);

    if (tokenAddresses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No launched tokens to update',
        stats: { tokens: 0, duration: Date.now() - startTime },
      });
    }

    logger.info(`Updating prices for ${tokenAddresses.length} tokens`);

    // Fetch stats for each token with rate limiting
    const allStats = new Map<string, TokenStats>();
    let successCount = 0;

    for (let i = 0; i < tokenAddresses.length; i++) {
      const address = tokenAddresses[i];
      const stats = await fetchSingleTokenStats(address);
      allStats.set(address, stats);

      if (stats.price !== null) {
        successCount++;
      }

      // Rate limit between API calls
      if (i < tokenAddresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }

    // Store all stats in Redis
    await storeAllStats(allStats);

    const duration = Date.now() - startTime;

    logger.info('Price update completed', {
      tokens: tokenAddresses.length,
      successCount,
      duration,
    });

    return NextResponse.json({
      success: true,
      stats: {
        tokens: tokenAddresses.length,
        successCount,
        duration,
      },
    });

  } catch (error) {
    logger.error('Cron job failed:', { error });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for Upstash QStash
export const POST = GET;
