/**
 * Hook to fetch launched tokens from resolved YesWins markets
 */

import useSWR from 'swr';
import { fetcher, ApiResponse } from '@pnl/shared/services';

export interface LaunchedToken {
  id: string;
  marketAddress: string;
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  stage?: string;
  projectType?: string;
  launchDate: string;
  tokenAddress: string;
  projectImageUrl?: string;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  yesPercentage: number;
  launchPool: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}

interface LaunchedData {
  launched: LaunchedToken[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function useLaunchedTokens(
  page = 1,
  limit = 50,
  category = 'all',
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(category !== 'all' && { category }),
  });

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<LaunchedData>>(
    `/api/markets/launched?${params}`,
    fetcher,
    {
      refreshInterval: 60_000,
      dedupingInterval: 5000,
      keepPreviousData: true,
      revalidateOnFocus: true,
    },
  );

  return {
    tokens: data?.data?.launched ?? [],
    total: data?.data?.total ?? 0,
    pagination: data?.data?.pagination ?? null,
    isLoading,
    error: error || (data?.success === false ? data.error : null),
    refresh: mutate,
  };
}
