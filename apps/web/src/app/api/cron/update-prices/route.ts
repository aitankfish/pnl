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

function emptyStats(address: string): TokenStats {
  return {
    address,
    price: null,
    priceChange24h: null,
    marketCap: null,
    volume24h: null,
    holders: null,
    liquidity: null,
    updatedAt: Date.now(),
  };
}

/**
 * Primary source: Birdeye token_overview. Server-only env var — see note
 * in /api/tokens/stats/route.ts. Legacy NEXT_PUBLIC_ name kept as fallback
 * while the env var rename rolls out. Returns null on any failure so the
 * caller can try the next source.
 */
async function fetchFromBirdeye(address: string): Promise<TokenStats | null> {
  const birdeyeApiKey = process.env.BIRDEYE_API_KEY || process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;
  if (!birdeyeApiKey) return null;

  try {
    const response = await fetch(
      `https://public-api.birdeye.so/defi/token_overview?address=${address}`,
      { headers: { 'X-API-KEY': birdeyeApiKey, 'x-chain': 'solana' } },
    );
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.data) return null;

    return {
      address,
      price: data.data.price ?? null,
      priceChange24h: data.data.priceChange24hPercent ?? null,
      marketCap: data.data.mc ?? null,
      volume24h: data.data.v24hUSD ?? null,
      holders: data.data.holder ?? null,
      liquidity: data.data.liquidity ?? null,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Fallback source: Jupiter Lite Price API. Free, no key required. Covers
 * price + priceChange24h + liquidity; marketCap/volume24h/holders stay
 * null. Lets the cron keep populating the cache even if Birdeye's quota
 * is exhausted or the account is mid-activation.
 */
async function fetchFromJupiter(address: string): Promise<TokenStats | null> {
  try {
    const response = await fetch(
      `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(address)}`,
    );
    if (!response.ok) return null;

    const data = await response.json();
    const entry = data?.[address];
    if (!entry || typeof entry.usdPrice !== 'number') return null;

    return {
      address,
      price: entry.usdPrice,
      priceChange24h: typeof entry.priceChange24h === 'number' ? entry.priceChange24h : null,
      marketCap: null,
      volume24h: null,
      holders: null,
      liquidity: typeof entry.liquidity === 'number' ? entry.liquidity : null,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchSingleTokenStats(address: string): Promise<TokenStats> {
  const stats = (await fetchFromBirdeye(address)) || (await fetchFromJupiter(address));
  if (stats) return stats;
  logger.warn(`No external source returned stats for ${address}`);
  return emptyStats(address);
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

  // Always require CRON_SECRET. The previous shape ("optional but
  // recommended") let any unauthenticated caller hit this on a preview
  // deploy or whenever the secret was unset — they could pollute the
  // price cache without authenticating. Now: missing or wrong secret =
  // 401, in every environment.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
