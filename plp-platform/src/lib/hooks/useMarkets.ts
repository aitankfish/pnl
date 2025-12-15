/**
 * useMarkets Hook
 * Optimized market data fetching with SWR + Socket.IO real-time updates
 */

'use client';

import useSWR from 'swr';
import { useEffect, useCallback } from 'react';
import { fetcher, realtimeConfig, ApiResponse } from '@/lib/swr-config';
import { useAllMarketsSocket, useMarketSocket } from './useSocket';

export interface Market {
  id: string;
  marketAddress: string;
  name: string;
  description: string;
  category: string;
  stage: string;
  tokenSymbol: string;
  targetPool: string;
  yesVotes: number;
  noVotes: number;
  totalYesStake: number;
  totalNoStake: number;
  timeLeft: string;
  expiryTime: string;
  status: string;
  metadataUri?: string;
  projectImageUrl?: string;
  yesPercentage?: number;
  noPercentage?: number;
  resolution?: string;
  phase?: string;
  poolProgressPercentage?: number;
  poolBalance?: number;
  displayStatus?: string;
  badgeClass?: string;
  isYesVoteEnabled?: boolean;
  isNoVoteEnabled?: boolean;
  yesVoteDisabledReason?: string;
  noVoteDisabledReason?: string;
  lastSyncedAt?: string | null;
  isStale?: boolean;
  syncStatus?: string;
}

export interface SyncHealth {
  healthy: boolean;
  staleCount: number;
  totalCount: number;
  message: string;
}

interface MarketsResponse {
  markets: Market[];
  total: number;
  syncHealth: SyncHealth;
}

/**
 * Hook to fetch all active markets with real-time updates
 */
export function useMarkets(category?: string) {
  // Fetch markets via SWR
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<MarketsResponse>>(
    '/api/markets/list',
    fetcher,
    {
      ...realtimeConfig,
      // Refresh every 30 seconds as baseline
      refreshInterval: 30000,
    }
  );

  // Socket.IO for real-time updates
  const { marketUpdates, isConnected: socketConnected } = useAllMarketsSocket();

  // Merge socket updates with SWR data
  const markets = data?.data?.markets?.map((market) => {
    const update = marketUpdates.get(market.marketAddress);
    if (update) {
      return { ...market, ...update };
    }
    return market;
  }) || [];

  // Filter by category if provided
  const filteredMarkets = category && category !== 'All'
    ? markets.filter((m) => m.category.toLowerCase() === category.toLowerCase())
    : markets;

  // Manual refresh function
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    markets: filteredMarkets,
    allMarkets: markets,
    syncHealth: data?.data?.syncHealth || null,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh,
    socketConnected,
  };
}

/**
 * Hook to fetch a single market by ID with real-time updates
 */
export function useMarket(marketId: string | null) {
  // Fetch market via SWR
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Market>>(
    marketId ? `/api/markets/${marketId}` : null,
    fetcher,
    {
      ...realtimeConfig,
      // Individual markets refresh every 15 seconds
      refreshInterval: 15000,
    }
  );

  // Get market address for socket subscription
  const marketAddress = data?.data?.marketAddress || null;

  // Socket.IO for real-time updates on this specific market
  const { marketData: socketUpdate, isConnected: socketConnected } = useMarketSocket(marketAddress);

  // Merge socket update with SWR data
  const market = data?.data ? {
    ...data.data,
    ...(socketUpdate || {}),
  } : null;

  // Manual refresh function
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    market,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh,
    socketConnected,
  };
}

/**
 * Hook to fetch launched markets
 */
export function useLaunchedMarkets() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<{ markets: Market[]; total: number }>>(
    '/api/markets/launched',
    fetcher,
    {
      ...realtimeConfig,
      // Launched markets change less frequently
      refreshInterval: 60000,
    }
  );

  return {
    markets: data?.data?.markets || [],
    total: data?.data?.total || 0,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh: mutate,
  };
}

/**
 * Hook to fetch market by address (for direct linking)
 */
export function useMarketByAddress(marketAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Market>>(
    marketAddress ? `/api/markets/check-onchain-status?address=${marketAddress}` : null,
    fetcher,
    realtimeConfig
  );

  // Socket.IO for real-time updates
  const { marketData: socketUpdate, isConnected: socketConnected } = useMarketSocket(marketAddress);

  const market = data?.data ? {
    ...data.data,
    ...(socketUpdate || {}),
  } : null;

  return {
    market,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh: mutate,
    socketConnected,
  };
}
