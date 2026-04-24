/**
 * GET /api/wallet/balance?address=<wallet>
 *
 * Returns the SOL balance for a wallet address, cached in Redis with a short TTL
 * to avoid hammering Helius RPC when many clients poll concurrently.
 *
 * This replaces direct `connection.getBalance()` calls from the browser. Benefits:
 *   - Shared cache across tabs, devices, and concurrent sessions
 *   - Centralized RPC spend (one call per wallet per TTL window, not per client)
 *   - Observability: we can log cache hits/misses from one place
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { RPC_ENDPOINT } from '@/config/solana';

const BALANCE_TTL_SECONDS = 5;

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json({ success: false, error: 'address query param required' }, { status: 400 });
  }

  // Validate the address shape early so we never cache or RPC-call garbage
  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(address);
  } catch {
    return NextResponse.json({ success: false, error: 'invalid Solana address' }, { status: 400 });
  }

  const cacheKey = prefixKey(`wallet-balance:${publicKey.toBase58()}`);

  try {
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      const { lamports, sol, cachedAt } = JSON.parse(cached);
      return NextResponse.json(
        { success: true, lamports, sol, cached: true, cachedAt },
        { headers: { 'Cache-Control': `public, max-age=${BALANCE_TTL_SECONDS}` } },
      );
    }
  } catch (err) {
    // Redis failure should not break the request — fall through to RPC
    console.warn('[wallet/balance] redis read failed, falling through to RPC', err);
  }

  // Cache miss — query RPC
  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const lamports = await connection.getBalance(publicKey);
    const sol = lamports / LAMPORTS_PER_SOL;
    const cachedAt = Date.now();

    // Best-effort cache write — don't block response if Redis is down
    try {
      const redis = getRedisClient();
      await redis.set(
        cacheKey,
        JSON.stringify({ lamports, sol, cachedAt }),
        'EX',
        BALANCE_TTL_SECONDS,
      );
    } catch (err) {
      console.warn('[wallet/balance] redis write failed', err);
    }

    return NextResponse.json(
      { success: true, lamports, sol, cached: false, cachedAt },
      { headers: { 'Cache-Control': `public, max-age=${BALANCE_TTL_SECONDS}` } },
    );
  } catch (err: any) {
    console.error('[wallet/balance] RPC getBalance failed', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'failed to fetch balance' },
      { status: 502 },
    );
  }
}
