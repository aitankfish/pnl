/**
 * Hook to fetch SOL price in USD.
 *
 * Instead of every browser hitting CoinGecko directly (which rate-limits at
 * scale), we route through our own /api/price/sol endpoint which caches the
 * result in Redis with a 60s TTL. This means all concurrent users share ONE
 * CoinGecko call per minute, not one call per client.
 *
 * SWR still dedupes + refreshes on the client side.
 */

import useSWR from 'swr';
import { apiUrl } from '../utils/api';

const FALLBACK_PRICE = 162.53;

async function fetchSolPrice(): Promise<number> {
  try {
    const response = await fetch(apiUrl('/api/price/sol'));
    if (!response.ok) throw new Error('Failed to fetch SOL price');
    const data = await response.json();
    const price = data?.price;
    if (typeof price !== 'number') throw new Error('SOL price missing in response');
    return price;
  } catch {
    return FALLBACK_PRICE;
  }
}

export function useSolPrice() {
  const { data: solPrice, error, isLoading } = useSWR(
    'sol-price-usd',
    fetchSolPrice,
    {
      refreshInterval: 120_000, // 2 minutes
      dedupingInterval: 60_000, // dedup within 1 minute
      revalidateOnFocus: false,
      fallbackData: FALLBACK_PRICE,
      errorRetryCount: 2,
      errorRetryInterval: 5000,
    },
  );

  return {
    solPrice: solPrice ?? FALLBACK_PRICE,
    isLoading,
    error: error?.message ?? null,
  };
}
