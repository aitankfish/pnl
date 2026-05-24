/**
 * POST /api/tokens/metadata
 *
 * Fetch token metadata (symbol, name, logo, decimals) using Helius DAS API.
 * Token metadata is IMMUTABLE per mint (name/symbol/logo never change), so we
 * cache aggressively in Redis with a 24h TTL. This turns one-per-user-per-token
 * Helius calls into one-per-token-per-day across the entire platform.
 *
 * Accepts either { mint: string } for a single mint or { mints: string[] }
 * for a batch request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { checkRateLimit } from '@/lib/auth/rate-limit';

const logger = createClientLogger();

function callerKey(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `tokens-meta:${ip}`;
}

// Token metadata is immutable — safe to cache for a long time.
// A day is a good balance: long enough to dominate cache hits, short enough
// that platform-side metadata edits (rare) propagate within 24h.
const METADATA_TTL_SECONDS = 24 * 60 * 60;

interface TokenMetadata {
  mint?: string;
  symbol: string;
  name: string;
  logoURI?: string;
  decimals: number;
}

function metaKey(mint: string): string {
  return prefixKey(`token-meta:${mint}`);
}

async function readCachedMetadata(mints: string[]): Promise<Map<string, TokenMetadata>> {
  const map = new Map<string, TokenMetadata>();
  if (mints.length === 0) return map;
  try {
    const redis = getRedisClient();
    const keys = mints.map(metaKey);
    // mget returns an array aligned with the input keys; null for misses
    const values = await redis.mget(...keys);
    for (let i = 0; i < mints.length; i++) {
      const raw = values[i];
      if (raw) {
        try {
          map.set(mints[i], JSON.parse(raw) as TokenMetadata);
        } catch {
          // Corrupt cache entry — ignore and treat as miss
        }
      }
    }
  } catch (err) {
    logger.warn('[tokens/metadata] redis mget failed', { err });
  }
  return map;
}

async function writeCachedMetadata(records: Array<{ mint: string; meta: TokenMetadata }>): Promise<void> {
  if (records.length === 0) return;
  try {
    const redis = getRedisClient();
    const pipe = redis.pipeline();
    for (const { mint, meta } of records) {
      pipe.set(metaKey(mint), JSON.stringify(meta), 'EX', METADATA_TTL_SECONDS);
    }
    await pipe.exec();
  } catch (err) {
    logger.warn('[tokens/metadata] redis pipeline write failed', { err });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 60 requests per minute per IP. Cache hits are free; cache misses fall
    // back to Helius DAS API (paid per RPC call). This bounds the cache-miss
    // attack where someone hammers random/invalid mints to drain Helius
    // quota.
    const rateLimited = await checkRateLimit(callerKey(request), 60, 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { mint, mints } = body;

    const heliusApiKey = process.env.HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('HELIUS_API_KEY not configured');
    }

    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet' ? 'devnet' : 'mainnet';
    const heliusUrl = `https://${network}.helius-rpc.com/?api-key=${heliusApiKey}`;

    // ── Batch mode: accept { mints: string[] } ──
    if (mints && Array.isArray(mints) && mints.length > 0) {
      const batchMints: string[] = mints.slice(0, 100).map((m: any) => String(m));

      // 1. Try Redis for all mints at once
      const cached = await readCachedMetadata(batchMints);

      // 2. Any misses? Fetch those from Helius in one batch call
      const misses = batchMints.filter((m) => !cached.has(m));
      const freshRecords: Array<{ mint: string; meta: TokenMetadata }> = [];

      if (misses.length > 0) {
        const response = await fetch(heliusUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'token-metadata-batch',
            method: 'getAssetBatch',
            params: { ids: misses },
          }),
        });

        if (!response.ok) throw new Error(`Helius batch API error: ${response.status}`);
        const data = await response.json();

        for (const asset of data.result || []) {
          if (!asset?.id) continue;
          const meta: TokenMetadata = {
            symbol: asset?.content?.metadata?.symbol || asset?.token_info?.symbol || 'UNKNOWN',
            name: asset?.content?.metadata?.name || asset?.token_info?.name || 'Unknown Token',
            logoURI: asset?.content?.links?.image || asset?.content?.files?.[0]?.uri,
            decimals: asset?.token_info?.decimals || 9,
          };
          cached.set(asset.id, meta);
          freshRecords.push({ mint: asset.id, meta });
        }

        // 3. Write fresh results back to Redis (fire-and-forget)
        writeCachedMetadata(freshRecords);
      }

      // 4. Assemble response preserving the order the caller requested
      const results = batchMints.map((m) => {
        const meta = cached.get(m);
        return meta ? { mint: m, ...meta } : { mint: m, symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 9 };
      });

      return NextResponse.json({
        success: true,
        metadata: results,
        batch: true,
        cached: misses.length === 0,
        cacheHits: batchMints.length - misses.length,
        cacheMisses: misses.length,
      });
    }

    // ── Single mode ──
    if (!mint) {
      return NextResponse.json(
        { success: false, error: 'Missing mint address or mints array' },
        { status: 400 }
      );
    }

    // Try cache first
    const cached = await readCachedMetadata([mint]);
    const cachedMeta = cached.get(mint);
    if (cachedMeta) {
      return NextResponse.json({ success: true, metadata: cachedMeta, cached: true });
    }

    // Miss — query Helius
    const response = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'token-metadata',
        method: 'getAsset',
        params: { id: mint },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      logger.warn('Helius API returned error', { mint, error: data.error });
      return NextResponse.json({
        success: false,
        error: 'Token metadata not found',
      });
    }

    const asset = data.result;

    if (asset?.interface !== 'FungibleToken' && asset?.interface !== 'FungibleAsset') {
      logger.warn('Asset is not a fungible token', { mint, interface: asset?.interface });
    }

    const metadata: TokenMetadata = {
      symbol: asset?.content?.metadata?.symbol || asset?.token_info?.symbol || 'UNKNOWN',
      name: asset?.content?.metadata?.name || asset?.token_info?.name || 'Unknown Token',
      logoURI: asset?.content?.links?.image || asset?.content?.files?.[0]?.uri,
      decimals: asset?.token_info?.decimals || 9,
    };

    // Write to cache (fire-and-forget)
    writeCachedMetadata([{ mint, meta: metadata }]);

    logger.info('Token metadata fetched successfully', { mint, metadata });

    return NextResponse.json({
      success: true,
      metadata,
      cached: false,
    });
  } catch (error) {
    logger.error('Failed to fetch token metadata:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch token metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
