/**
 * Token Stats API
 *
 * Reads pre-cached token prices from Redis.
 * Prices are updated by the cron job (/api/cron/update-prices)
 *
 * This ensures:
 * - Instant response (no external API calls)
 * - All users get same data
 * - Scalable to thousands of tokens
 *
 * Fallback: If a token isn't in cache (new token before cron runs),
 * it will fetch from Birdeye directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { checkRateLimit } from '@/lib/auth/rate-limit';

// Extract caller IP for rate-limiting unauthenticated endpoints. Behind
// Cloudflare + Render, the real client IP is in the first comma-separated
// entry of x-forwarded-for. Falls back to a constant key so the limiter
// still bounds total platform-wide rate even when headers are missing.
function callerKey(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `tokens-stats:${ip}`;
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

const REDIS_KEY_PREFIX = 'token-stats:';

/**
 * Get cached stats from Redis
 */
async function getCachedStats(address: string): Promise<TokenStats | null> {
  try {
    const redis = getRedisClient();
    const key = prefixKey(`${REDIS_KEY_PREFIX}${address}`);
    const cached = await redis.get(key);

    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    console.error(`Redis get error for ${address}:`, error);
    return null;
  }
}

/**
 * Batch get multiple stats from Redis using pipeline
 */
async function getBatchCachedStats(addresses: string[]): Promise<Map<string, TokenStats | null>> {
  const results = new Map<string, TokenStats | null>();

  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();

    for (const address of addresses) {
      const key = prefixKey(`${REDIS_KEY_PREFIX}${address}`);
      pipeline.get(key);
    }

    const pipelineResults = await pipeline.exec();

    if (pipelineResults) {
      for (let i = 0; i < addresses.length; i++) {
        const result = pipelineResults[i];
        if (result && result[1]) {
          try {
            results.set(addresses[i], JSON.parse(result[1] as string));
          } catch {
            results.set(addresses[i], null);
          }
        } else {
          results.set(addresses[i], null);
        }
      }
    }
  } catch (error) {
    console.error('Redis batch get error:', error);
    // Return empty results on error
    for (const address of addresses) {
      results.set(address, null);
    }
  }

  return results;
}

/**
 * Fallback: Fetch from Birdeye for tokens not in cache
 */
async function fetchFromBirdeyeFallback(address: string): Promise<TokenStats> {
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

    const stats: TokenStats = {
      address,
      price: data.data.price || null,
      priceChange24h: data.data.priceChange24hPercent || null,
      marketCap: data.data.mc || null,
      volume24h: data.data.v24hUSD || null,
      holders: data.data.holder || null,
      liquidity: data.data.liquidity || null,
      updatedAt: Date.now(),
    };

    // Cache it for next time
    try {
      const redis = getRedisClient();
      const key = prefixKey(`${REDIS_KEY_PREFIX}${address}`);
      await redis.setex(key, 120, JSON.stringify(stats));
    } catch {
      // Ignore cache errors
    }

    return stats;
  } catch {
    return emptyStats;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 60 requests per minute per IP. Cache hits are cheap (Redis), but cache
    // misses fall back to Birdeye (paid). This bounds the cache-miss attack
    // surface where someone hammers random/invalid mints to drain Birdeye
    // quota.
    const rateLimited = checkRateLimit(callerKey(request), 60, 60_000);
    if (rateLimited) return rateLimited;

    const { addresses } = await request.json();

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid addresses array' },
        { status: 400 }
      );
    }

    // Limit to 100 tokens per request
    const limitedAddresses = addresses.slice(0, 100);

    // Batch get all from Redis (single round trip)
    const cachedStats = await getBatchCachedStats(limitedAddresses);

    // Find tokens not in cache
    const missingAddresses: string[] = [];
    const results: TokenStats[] = [];

    for (const address of limitedAddresses) {
      const cached = cachedStats.get(address);
      if (cached) {
        results.push(cached);
      } else {
        missingAddresses.push(address);
      }
    }

    // Fallback: Fetch missing tokens from Birdeye (should be rare)
    if (missingAddresses.length > 0) {
      console.log(`Fetching ${missingAddresses.length} tokens from Birdeye (not in cache)`);

      // Limit fallback fetches to prevent abuse
      const fallbackLimit = Math.min(missingAddresses.length, 10);

      for (let i = 0; i < fallbackLimit; i++) {
        const stats = await fetchFromBirdeyeFallback(missingAddresses[i]);
        results.push(stats);
        // Rate limit
        if (i < fallbackLimit - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // For remaining missing tokens, return empty stats
      for (let i = fallbackLimit; i < missingAddresses.length; i++) {
        results.push({
          address: missingAddresses[i],
          price: null,
          priceChange24h: null,
          marketCap: null,
          volume24h: null,
          holders: null,
          liquidity: null,
          updatedAt: Date.now(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        cached: limitedAddresses.length - missingAddresses.length,
        fetched: Math.min(missingAddresses.length, 10),
        missing: Math.max(0, missingAddresses.length - 10),
      },
    });
  } catch (error) {
    console.error('Failed to fetch token stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch token stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for single token
export async function GET(request: NextRequest) {
  // Same rate-limit bound as POST — cache-miss attack hits the same Birdeye
  // quota whether through batch POST or single GET.
  const rateLimited = checkRateLimit(callerKey(request), 60, 60_000);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  // Try cache first
  let stats = await getCachedStats(address);

  // Fallback to Birdeye if not cached
  if (!stats) {
    stats = await fetchFromBirdeyeFallback(address);
  }

  return NextResponse.json({
    success: true,
    data: stats,
  });
}
