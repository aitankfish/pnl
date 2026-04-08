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
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<{ followers: FollowUser[]; total: number }>>(
    wallet ? `/api/profile/${wallet}/followers` : null,
    fetcher,
    { dedupingInterval: 10_000 },
  );

  return {
    followers: data?.data?.followers ?? [],
    total: data?.data?.total ?? 0,
    isLoading,
    error,
    refresh: mutate,
  };
}

export function useFollowing(wallet: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<{ following: FollowUser[]; total: number }>>(
    wallet ? `/api/profile/${wallet}/following` : null,
    fetcher,
    { dedupingInterval: 10_000 },
  );

  return {
    following: data?.data?.following ?? [],
    total: data?.data?.total ?? 0,
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
        const method = isCurrentlyFollowing ? 'DELETE' : 'POST';
        const url = isCurrentlyFollowing
          ? apiUrl(`/api/profile/${targetWallet}/follow?followerWallet=${myWallet}`)
          : apiUrl(`/api/profile/${targetWallet}/follow`);
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(method === 'POST' ? { body: JSON.stringify({ followerWallet: myWallet }) } : {}),
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
