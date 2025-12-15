/**
 * usePositions Hook
 * Optimized user position data fetching with SWR + Socket.IO real-time updates
 */

'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { fetcher, userConfig, ApiResponse } from '@/lib/swr-config';
import { useUserSocket } from './useSocket';

export interface Position {
  id: string;
  marketId: string;
  marketAddress: string;
  marketName: string;
  projectName: string;
  projectImageUrl?: string;
  voteType: 'yes' | 'no';
  shares: string;
  solInvested: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  claimed: boolean;
  resolution?: string;
  phase?: string;
  expiryTime: string;
  createdAt: string;
}

export interface PositionStats {
  totalPositions: number;
  totalInvested: number;
  totalCurrentValue: number;
  totalProfitLoss: number;
  winRate: number;
}

interface PositionsResponse {
  positions: Position[];
  stats: PositionStats;
}

/**
 * Hook to fetch user positions with real-time updates
 */
export function usePositions(walletAddress: string | null) {
  // Fetch positions via SWR
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<PositionsResponse>>(
    walletAddress ? `/api/user/${walletAddress}/positions` : null,
    fetcher,
    {
      ...userConfig,
      // Positions refresh every 30 seconds
      refreshInterval: 30000,
    }
  );

  // Socket.IO for real-time position updates
  const { positions: socketUpdates, isConnected: socketConnected } = useUserSocket(walletAddress);

  // Merge socket updates with SWR data
  const positions = data?.data?.positions?.map((position) => {
    const update = socketUpdates.get(position.marketAddress);
    if (update) {
      return { ...position, ...update };
    }
    return position;
  }) || [];

  // Manual refresh function
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    positions,
    stats: data?.data?.stats || null,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh,
    socketConnected,
  };
}

/**
 * Hook to fetch position for a specific market
 */
export function usePosition(walletAddress: string | null, marketId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Position>>(
    walletAddress && marketId ? `/api/markets/${marketId}/position?wallet=${walletAddress}` : null,
    fetcher,
    {
      ...userConfig,
      // Individual position refreshes more frequently
      refreshInterval: 15000,
    }
  );

  return {
    position: data?.data || null,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh: mutate,
  };
}

/**
 * Hook to fetch user's transaction history
 */
export function useTransactionHistory(walletAddress: string | null, limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<{ transactions: any[]; total: number }>>(
    walletAddress ? `/api/user/${walletAddress}/history?limit=${limit}` : null,
    fetcher,
    {
      ...userConfig,
      // History refreshes every minute
      refreshInterval: 60000,
    }
  );

  return {
    transactions: data?.data?.transactions || [],
    total: data?.data?.total || 0,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh: mutate,
  };
}

/**
 * Hook to fetch user's portfolio stats
 */
export function usePortfolioStats(walletAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<{
    totalInvested: number;
    totalCurrentValue: number;
    totalProfitLoss: number;
    activePositions: number;
    completedPositions: number;
    winRate: number;
  }>>(
    walletAddress ? `/api/user/${walletAddress}/stats` : null,
    fetcher,
    {
      ...userConfig,
      // Stats refresh every 30 seconds
      refreshInterval: 30000,
    }
  );

  return {
    stats: data?.data || null,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh: mutate,
  };
}
