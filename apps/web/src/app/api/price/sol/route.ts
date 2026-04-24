/**
 * GET /api/price/sol
 *
 * Returns current SOL price in USD. Cached in Redis with 60s TTL so every
 * client shares one CoinGecko call per minute instead of each browser calling
 * CoinGecko directly (which would rate-limit at scale — CoinGecko free tier
 * is 10-30 req/min per origin).
 */

import { NextResponse } from 'next/server';
import { getRedisClient, prefixKey } from '@/lib/redis/client';

const PRICE_TTL_SECONDS = 60;
const FALLBACK_PRICE = 162.53;
const CACHE_KEY = 'sol-price-usd';

export const dynamic = 'force-dynamic';

async function getCachedPrice(): Promise<{ price: number; cachedAt: number } | null> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(prefixKey(CACHE_KEY));
    if (raw) return JSON.parse(raw);
  } catch {
    // Redis miss or error — fall through
  }
  return null;
}

async function setCachedPrice(price: number): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(
      prefixKey(CACHE_KEY),
      JSON.stringify({ price, cachedAt: Date.now() }),
      'EX',
      PRICE_TTL_SECONDS,
    );
  } catch {
    // Non-fatal
  }
}

export async function GET() {
  // 1. Redis cache (shared across all clients)
  const cached = await getCachedPrice();
  if (cached) {
    return NextResponse.json(
      { success: true, price: cached.price, cached: true, cachedAt: cached.cachedAt },
      { headers: { 'Cache-Control': `public, max-age=${PRICE_TTL_SECONDS}` } },
    );
  }

  // 2. Cache miss — query CoinGecko
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      {
        // Don't trust Next's own fetch-level cache here; we're the cache.
        cache: 'no-store',
      },
    );
    if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
    const data = await response.json();
    const price = data?.solana?.usd;
    if (typeof price !== 'number') throw new Error('SOL price missing in response');

    // Write back (fire-and-forget)
    setCachedPrice(price);

    return NextResponse.json(
      { success: true, price, cached: false, cachedAt: Date.now() },
      { headers: { 'Cache-Control': `public, max-age=${PRICE_TTL_SECONDS}` } },
    );
  } catch (err: any) {
    console.warn('[price/sol] CoinGecko fetch failed, returning fallback', err?.message);
    // Return the static fallback so the UI still renders something sensible
    return NextResponse.json(
      {
        success: true,
        price: FALLBACK_PRICE,
        cached: false,
        fallback: true,
        error: err?.message || 'price lookup failed',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
