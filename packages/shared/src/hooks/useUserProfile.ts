/**
 * Hook to fetch and manage user profile data
 * Provides profile information including username and profile photo
 */

import useSWR from 'swr';
import { useWallet } from './useWallet';
import { apiUrl } from '../utils/api';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface UserProfile {
  walletAddress: string;
  username?: string;
  email?: string;
  profilePhotoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useUserProfile() {
  const { primaryWallet, user } = useWallet();

  // Fetch user profile from MongoDB
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data?: UserProfile;
    error?: string;
  }>(
    primaryWallet?.address ? apiUrl(`/api/profile/${primaryWallet.address}`) : null,
    fetcher,
    {
      refreshInterval: 0, // Don't auto-refresh, manual refresh only
      revalidateOnFocus: false,
    }
  );

  const profile = data?.success && data.data ? data.data : null;

  // Get display name (priority: username > email prefix > address)
  const emailString = typeof user?.email === 'string' ? user.email : (user?.email as any)?.address;
  const displayName = profile?.username
    || (emailString ? emailString.split('@')[0] : null)
    || primaryWallet?.address?.slice(0, 8)
    || 'User';

  // Get profile photo URL (priority: stored photo > Privy photo > null)
  const profilePhotoUrl = profile?.profilePhotoUrl || user?.profileImageUrl || null;

  return {
    profile,
    displayName,
    profilePhotoUrl,
    isLoading,
    error,
    refreshProfile: mutate,
  };
}
