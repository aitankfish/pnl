/**
 * Hook to fetch live token stats (price, mcap, holders, etc.)
 * Uses SWR for smart caching and deduplication
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import { apiUrl } from '@pnl/shared/utils';

export interface TokenStats {
  address: string;
  price: number | null;
  priceChange24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  holders: number | null;
  liquidity: number | null;
  updatedAt: number;
}

async function fetchTokenStats(addresses: string[]): Promise<TokenStats[]> {
  const res = await fetch(apiUrl('/api/tokens/stats'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses }),
  });
  if (!res.ok) throw new Error('Failed to fetch token stats');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Stats fetch failed');
  return json.data as TokenStats[];
}

export function useTokenStats(addresses: string[]) {
  const addressKey = useMemo(() => [...addresses].sort().join(','), [addresses]);

  const { data, error, isLoading, mutate } = useSWR(
    addressKey ? `token-stats:${addressKey}` : null,
    () => fetchTokenStats(addresses),
    {
      refreshInterval: 120_000,
      dedupingInterval: 15_000,
      revalidateOnFocus: false,
      errorRetryCount: 2,
    },
  );

  const stats = useMemo(() => {
    const map = new Map<string, TokenStats>();
    if (data) {
      for (const stat of data) {
        map.set(stat.address, stat);
      }
    }
    return map;
  }, [data]);

  return { stats, prevPrices: new Map<string, number | null>(), isLoading, error, refresh: mutate };
}
