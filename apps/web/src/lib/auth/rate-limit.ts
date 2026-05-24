/**
 * Rate limiter for API routes — Redis-backed.
 *
 * Why Redis: an in-process Map only counts requests on the current replica,
 * so any horizontally-scaled deploy (Render, Vercel, ECS) lets an attacker
 * round-robin across instances to multiply their quota. Redis gives every
 * replica a single shared counter.
 *
 * Fallback: if Redis is unreachable, we degrade to a per-process Map so a
 * Redis outage doesn't turn every API call into a 503. This loosens the
 * limit during incidents but keeps the system usable.
 */

import { NextResponse } from 'next/server';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

interface FallbackEntry {
  count: number;
  resetAt: number;
}

const fallbackStore = new Map<string, FallbackEntry>();

// Sweep expired fallback entries every 5 min so the Map doesn't grow.
if (typeof process !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, e] of fallbackStore) {
      if (e.resetAt < now) fallbackStore.delete(k);
    }
  }, 5 * 60 * 1000);
}

/**
 * Check rate limit for a key. Returns null if allowed, or a 429 Response.
 *
 * @param key - Unique identifier (usually wallet address, sometimes IP).
 * @param maxRequests - Max requests allowed in the window.
 * @param windowMs - Time window in milliseconds.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000,
): Promise<NextResponse | null> {
  const redisKey = prefixKey(`ratelimit:${key}`);

  try {
    const redis = getRedisClient();
    // INCR returns the new count; if the key didn't exist, count == 1 and we
    // attach the TTL atomically. PTTL on a key with no expiry returns -1; we
    // use that to recover from any state where the expiry got lost.
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.pttl(redisKey);
    const results = await pipeline.exec();
    if (!results) throw new Error('redis pipeline returned null');

    const count = results[0][1] as number;
    let ttlMs = results[1][1] as number;

    if (count === 1 || ttlMs < 0) {
      await redis.pexpire(redisKey, windowMs);
      ttlMs = windowMs;
    }

    if (count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Try again in ${retryAfter}s.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      );
    }
    return null;
  } catch (err) {
    // Redis is down or misconfigured. Fall back to per-process counter so
    // legitimate users don't get 503'd, but log loudly so we notice.
    logger.warn('Rate limit Redis fallback', {
      key,
      err: err instanceof Error ? err.message : String(err),
    });
    return checkRateLimitFallback(key, maxRequests, windowMs);
  }
}

function checkRateLimitFallback(
  key: string,
  maxRequests: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now();
  const entry = fallbackStore.get(key);

  if (!entry || entry.resetAt < now) {
    fallbackStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: `Rate limit exceeded. Try again in ${retryAfter}s.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    );
  }

  return null;
}
