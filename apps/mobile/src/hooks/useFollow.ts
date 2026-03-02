/**
 * useFollow — followers/following data + follow/unfollow actions
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { fetcher, type ApiResponse } from '@pnl/shared/services';
import { apiUrl } from '@pnl/shared/utils';

export interface FollowUser {
  walletAddress: string;
  username?: string;
  profilePhotoUrl?: string;
  bio?: string;
  reputationScore: number;
}

export function useFollowers(wallet: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<FollowUser[]>>(
    wallet ? `/api/profile/${wallet}/followers` : null,
    fetcher,
    { dedupingInterval: 10_000 },
  );

  return {
    followers: data?.data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}

export function useFollowing(wallet: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<FollowUser[]>>(
    wallet ? `/api/profile/${wallet}/following` : null,
    fetcher,
    { dedupingInterval: 10_000 },
  );

  return {
    following: data?.data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}

export function useToggleFollow(myWallet: string | null) {
  const [isToggling, setIsToggling] = useState(false);

  const toggleFollow = useCallback(
    async (targetWallet: string, isCurrentlyFollowing: boolean) => {
      if (!myWallet || isToggling) return false;
      setIsToggling(true);

      try {
        const res = await fetch(apiUrl(`/api/profile/${targetWallet}/follow`), {
          method: isCurrentlyFollowing ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: myWallet }),
        });
        const data = await res.json();
        return data.success ?? false;
      } catch {
        return false;
      } finally {
        setIsToggling(false);
      }
    },
    [myWallet, isToggling],
  );

  return { toggleFollow, isToggling };
}
