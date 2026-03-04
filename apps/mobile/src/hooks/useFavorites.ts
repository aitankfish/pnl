/**
 * useFavorites — watchlist / favorited markets
 * Reads favoriteMarkets[] from profile, fetches market data for each.
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { fetcher, type ApiResponse } from '@pnl/shared/services';
import { apiUrl } from '@pnl/shared/utils';

export interface FavoriteMarket {
  id: string;
  title: string;
  tokenSymbol?: string;
  status: string;
  displayStatus?: string;
  projectImageUrl?: string;
  poolBalance?: number;
  targetPool?: number;
  totalParticipants?: number;
  endTime?: string;
}

export function useFavorites(walletAddress: string | null, favoriteMarketIds: string[]) {
  const [isToggling, setIsToggling] = useState(false);

  // Fetch all favorited market data from profile favorites endpoint
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<{ favorites: FavoriteMarket[]; total: number }>>(
    walletAddress && favoriteMarketIds.length > 0
      ? `/api/profile/${walletAddress}/favorites`
      : null,
    fetcher,
    {
      refreshInterval: 60_000,
      dedupingInterval: 10_000,
    },
  );

  const toggleFavorite = useCallback(
    async (marketId: string) => {
      if (!walletAddress || isToggling) return false;
      setIsToggling(true);

      try {
        const res = await fetch(apiUrl(`/api/profile/${walletAddress}/favorites`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketId }),
        });
        const result = await res.json();
        if (result.success) {
          mutate();
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsToggling(false);
      }
    },
    [walletAddress, isToggling, mutate],
  );

  return {
    favorites: data?.data?.favorites ?? [],
    isLoading,
    error,
    toggleFavorite,
    isToggling,
    refresh: mutate,
  };
}
