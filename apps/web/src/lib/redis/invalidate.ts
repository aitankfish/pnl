/**
 * Best-effort cache invalidation helper.
 *
 * Mutation endpoints call invalidateCache() with the suffix(es) they touched
 * so the corresponding cached GET endpoints serve fresh data on the next hit.
 *
 * Failure modes:
 *   - Redis down → caches expire naturally via their TTLs (5s–1h depending on key)
 *   - Pattern matches nothing → no-op
 *   - Caller passes a stale key shape → no-op (the bogus key just isn't there)
 *
 * Errors are logged at warn and swallowed so a Redis blip never fails a write.
 */

import { getRedisClient, prefixKey } from './client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

/**
 * Invalidate one or more cache keys. Keys can be:
 *   - exact suffix: `markets:position:${marketId}:${userWallet}`  → DEL
 *   - pattern with `*`: `markets:list:*`                          → SCAN MATCH + DEL
 *
 * Prefix is applied automatically (dev-mainnet:, prod-mainnet:, etc.)
 */
export async function invalidateCache(...suffixes: string[]): Promise<void> {
  if (suffixes.length === 0) return;

  try {
    const redis = getRedisClient();
    const exactKeys: string[] = [];
    const patterns: string[] = [];

    for (const s of suffixes) {
      if (s.includes('*')) patterns.push(prefixKey(s));
      else exactKeys.push(prefixKey(s));
    }

    if (exactKeys.length > 0) {
      await redis.del(...exactKeys);
    }

    for (const pattern of patterns) {
      let cursor = '0';
      do {
        const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (batch.length > 0) {
          await redis.del(...batch);
        }
      } while (cursor !== '0');
    }
  } catch (err) {
    logger.warn('[invalidateCache] best-effort failed', {
      error: err instanceof Error ? err.message : String(err),
      suffixes,
    });
  }
}
