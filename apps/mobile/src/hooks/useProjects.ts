/**
 * useProjects — fetch user's created prediction markets / projects
 */

import useSWR from 'swr';
import { fetcher, type ApiResponse } from '@pnl/shared/services';

export interface UserProject {
  id: string;
  name: string;
  tokenSymbol?: string;
  status: string;
  displayStatus?: string;
  poolProgressPercentage: number;
  sharesYesPercentage: number;
  timeLeft?: string;
  projectImageUrl?: string;
  totalParticipants?: number;
  poolBalance?: number;
  targetPool?: number;
}

export function useProjects(walletAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<{ projects: UserProject[]; total: number }>>(
    walletAddress ? `/api/user/${walletAddress}/projects` : null,
    fetcher,
    {
      refreshInterval: 60_000,
      dedupingInterval: 10_000,
    },
  );

  return {
    projects: data?.data?.projects ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
