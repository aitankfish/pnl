/**
 * Cron Job: Update All Token Prices
 *
 * Runs every minute to fetch prices for ALL launched tokens using Birdeye's
 * multi-token API. This ensures:
 * - All users get instant cached prices (no cold cache)
 * - Minimal Birdeye API calls (batched, not per-token)
 * - Scalable to thousands of tokens
 *
 * Trigger: Vercel Cron or Upstash QStash
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

// Birdeye multi-price endpoint supports up to 100 tokens
const BATCH_SIZE = 50;
const REDIS_KEY_PREFIX = 'token-stats:';
const CACHE_TTL_SECONDS = 120; // 2 minutes (cron runs every 1 min, so always fresh)

interface BirdeyeMultiPriceResponse {
  success: boolean;
  data: {
    [address: string]: {
      value: number;
      updateUnixTime: number;
      updateHumanTime: string;
      priceChange24h: number;
    };
  };
}

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
 * Fetch prices for multiple tokens in one API call
 */
async function fetchMultiTokenPrices(addresses: string[]): Promise<Map<string, TokenStats>> {
  const birdeyeApiKey = process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;
  const results = new Map<string, TokenStats>();

  if (!birdeyeApiKey) {
    logger.warn('BIRDEYE_API_KEY not configured');
    return results;
  }

  try {
    // Birdeye multi_price endpoint
    const addressList = addresses.join(',');
    const response = await fetch(
      `https://public-api.birdeye.so/defi/multi_price?list_address=${addressList}`,
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

    const data: BirdeyeMultiPriceResponse = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Invalid Birdeye response');
    }

    // Process each token's price data
    const now = Date.now();
    for (const address of addresses) {
      const priceData = data.data[address];

      results.set(address, {
        address,
        price: priceData?.value || null,
        priceChange24h: priceData?.priceChange24h || null,
        // Multi-price doesn't include these, will be null
        marketCap: null,
        volume24h: null,
        holders: null,
        liquidity: null,
        updatedAt: now,
      });
    }
  } catch (error) {
    logger.error('Error fetching multi-token prices:', { error, count: addresses.length });

    // Return empty stats for all tokens on error
    const now = Date.now();
    for (const address of addresses) {
      results.set(address, {
        address,
        price: null,
        priceChange24h: null,
        marketCap: null,
        volume24h: null,
        holders: null,
        liquidity: null,
        updatedAt: now,
      });
    }
  }

  return results;
}

/**
 * Fetch detailed stats for tokens (includes market cap, holders, etc.)
 * Uses individual calls but only for visible/important tokens
 */
async function fetchDetailedStats(address: string): Promise<TokenStats> {
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

    if (!response.ok) throw new Error(`Birdeye API error: ${response.status}`);

    const data = await response.json();
    if (!data.success || !data.data) throw new Error('Invalid response');

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
  } catch {
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

    // Batch fetch prices using multi-token API
    const allStats = new Map<string, TokenStats>();
    let birdeyeApiCalls = 0;

    for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
      const batch = tokenAddresses.slice(i, i + BATCH_SIZE);
      const batchStats = await fetchMultiTokenPrices(batch);
      birdeyeApiCalls++;

      // Merge into all stats
      for (const [address, stats] of batchStats) {
        allStats.set(address, stats);
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < tokenAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // For top tokens (first 10), fetch detailed stats
    const topTokens = tokenAddresses.slice(0, 10);
    for (const address of topTokens) {
      const detailed = await fetchDetailedStats(address);
      if (detailed.marketCap !== null) {
        allStats.set(address, detailed);
        birdeyeApiCalls++;
      }
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Store all stats in Redis
    await storeAllStats(allStats);

    const duration = Date.now() - startTime;

    logger.info('Price update completed', {
      tokens: tokenAddresses.length,
      birdeyeApiCalls,
      duration,
    });

    return NextResponse.json({
      success: true,
      stats: {
        tokens: tokenAddresses.length,
        birdeyeApiCalls,
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
