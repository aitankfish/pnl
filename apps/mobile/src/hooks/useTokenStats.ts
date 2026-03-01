/**
 * Hook to fetch live token stats (price, mcap, holders, etc.)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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

export function useTokenStats(addresses: string[]) {
  const [stats, setStats] = useState<Map<string, TokenStats>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevPrices, setPrevPrices] = useState<Map<string, number | null>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addressKey = addresses.sort().join(',');

  const fetchStats = useCallback(async () => {
    if (addresses.length === 0) return;

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(apiUrl('/api/tokens/stats'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses }),
      });

      if (!res.ok) throw new Error('Failed to fetch token stats');

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Stats fetch failed');

      const newStats = new Map<string, TokenStats>();
      const newPrevPrices = new Map<string, number | null>();

      for (const stat of json.data as TokenStats[]) {
        newStats.set(stat.address, stat);
        // Track previous price for flash detection
        const old = stats.get(stat.address);
        newPrevPrices.set(stat.address, old?.price ?? null);
      }

      setPrevPrices(newPrevPrices);
      setStats(newStats);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  }, [addressKey]);

  useEffect(() => {
    fetchStats();

    intervalRef.current = setInterval(fetchStats, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStats]);

  return { stats, prevPrices, isLoading, error, refresh: fetchStats };
}
