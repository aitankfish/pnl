/**
 * usePositions — fetch user's prediction market positions
 * Mirrors web's /api/user/[wallet]/positions endpoint.
 */

import useSWR from 'swr';
import { fetcher, type ApiResponse } from '@pnl/shared/services';

export interface Position {
  marketId: string;
  marketName: string;
  marketAddress: string;
  voteType: 'yes' | 'no';
  totalAmount: number;
  totalShares: number;
  tradeCount: number;
  averagePrice: number;
  currentYesPrice: number;
  currentNoPrice: number;
  marketState: number;
  resolution: string;
  canClaim: boolean;
  isWinner: boolean;
  claimed: boolean;
  expiryTime: string;
  projectImageUrl?: string;
  tokenSymbol?: string;
}

interface PositionsData {
  all: Position[];
  active: Position[];
  resolved: Position[];
  claimable: Position[];
}

export function usePositions(walletAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<PositionsData>>(
    walletAddress ? `/api/user/${walletAddress}/positions` : null,
    fetcher,
    {
      refreshInterval: 30_000,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
    },
  );

  const positions = data?.data ?? null;

  return {
    positions,
    active: positions?.active ?? [],
    resolved: positions?.resolved ?? [],
    claimable: positions?.claimable ?? [],
    all: positions?.all ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
