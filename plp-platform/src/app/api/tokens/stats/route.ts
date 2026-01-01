/**
 * Batch fetch token stats from Birdeye API
 * Returns price, market cap, volume, holders for multiple tokens
 */

import { NextRequest, NextResponse } from 'next/server';

interface TokenStats {
  address: string;
  price: number | null;
  priceChange24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  holders: number | null;
  liquidity: number | null;
}

// Simple in-memory cache (in production, use Redis)
const cache = new Map<string, { data: TokenStats; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

async function fetchTokenStats(address: string): Promise<TokenStats> {
  // Check cache first
  const cached = cache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const birdeyeApiKey = process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;

  if (!birdeyeApiKey) {
    console.warn('BIRDEYE_API_KEY not configured');
    return {
      address,
      price: null,
      priceChange24h: null,
      marketCap: null,
      volume24h: null,
      holders: null,
      liquidity: null,
    };
  }

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

    const stats: TokenStats = {
      address,
      price: data.data.price || null,
      priceChange24h: data.data.priceChange24hPercent || null,
      marketCap: data.data.mc || null,
      volume24h: data.data.v24hUSD || null,
      holders: data.data.holder || null,
      liquidity: data.data.liquidity || null,
    };

    // Cache the result
    cache.set(address, { data: stats, timestamp: Date.now() });

    return stats;
  } catch (error) {
    console.error(`Error fetching stats for ${address}:`, error);
    return {
      address,
      price: null,
      priceChange24h: null,
      marketCap: null,
      volume24h: null,
      holders: null,
      liquidity: null,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { addresses } = await request.json();

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid addresses array' },
        { status: 400 }
      );
    }

    // Limit to 50 tokens per request to avoid rate limits
    const limitedAddresses = addresses.slice(0, 50);

    // Fetch stats for all tokens in parallel with rate limiting
    const stats: TokenStats[] = [];
    const batchSize = 5; // Fetch 5 at a time to avoid rate limits

    for (let i = 0; i < limitedAddresses.length; i += batchSize) {
      const batch = limitedAddresses.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((address: string) => fetchTokenStats(address))
      );
      stats.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < limitedAddresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json({
      success: true,
      data: stats,
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

// Also support GET with query params for single token
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  const stats = await fetchTokenStats(address);

  return NextResponse.json({
    success: true,
    data: stats,
  });
}
