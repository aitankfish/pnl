/**
 * Shared GitHub API helpers. Centralises auth headers, rate-limit handling,
 * and Redis-cached fetches so each endpoint that talks to GitHub doesn't
 * have to reimplement them.
 */

import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const GITHUB_API = 'https://api.github.com';
export const USER_AGENT = 'PNL-Research-Reader/1.0';

export interface RepoIdent {
  owner: string;
  repo: string;
}

export function parseRepoFromUrl(url: string): RepoIdent | null {
  const cleaned = url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^github\.com\//i, '');
  const parts = cleaned.split(/[/?#]/).filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return null;
  }
  return { owner, repo };
}

export function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * Fetch a GitHub API path as JSON, with Redis caching keyed by the URL +
 * an optional cacheTag. Returns one of three shapes so callers can
 * gracefully render rate-limit / not-found / error states.
 */
export type GhResult<T> =
  | { kind: 'ok'; data: T; cached: boolean }
  | { kind: 'not-found' }
  | { kind: 'rate-limited' }
  | { kind: 'error'; status: number };

export async function ghCachedFetch<T>(
  path: string,
  {
    cacheKey,
    ttlSeconds,
    accept = 'application/vnd.github+json',
  }: { cacheKey: string; ttlSeconds: number; accept?: string },
): Promise<GhResult<T>> {
  const redisKey = prefixKey(`gh:${cacheKey}`);

  // Try cache first.
  try {
    const redis = getRedisClient();
    const cached = await redis.get(redisKey);
    if (cached) {
      return { kind: 'ok', data: JSON.parse(cached) as T, cached: true };
    }
  } catch (err) {
    logger.warn('[github] redis read failed; bypassing cache', {
      err: err instanceof Error ? err.message : String(err),
    } as any);
  }

  const headers = ghHeaders();
  if (accept) headers.Accept = accept;
  const res = await fetch(`${GITHUB_API}${path}`, { headers });

  if (res.status === 404) return { kind: 'not-found' };
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') return { kind: 'rate-limited' };
    return { kind: 'error', status: 403 };
  }
  if (!res.ok) {
    return { kind: 'error', status: res.status };
  }

  const data = (await res.json()) as T;

  try {
    const redis = getRedisClient();
    await redis.setex(redisKey, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    logger.warn('[github] redis write failed', {
      err: err instanceof Error ? err.message : String(err),
    } as any);
  }

  return { kind: 'ok', data, cached: false };
}

/**
 * Map a non-ok GhResult to a NextResponse error body. Caller handles
 * `kind === 'ok'` themselves.
 */
export function errorBodyFor(kind: 'not-found' | 'rate-limited' | 'error', status?: number) {
  if (kind === 'not-found') {
    return { body: { success: false, error: 'Not found' }, status: 404 };
  }
  if (kind === 'rate-limited') {
    return {
      body: { success: false, error: 'GitHub rate limit exceeded' },
      status: 502,
    };
  }
  return {
    body: { success: false, error: `GitHub returned ${status ?? 'an error'}` },
    status: 502,
  };
}
