/**
 * useProfile — fetch + update user profile from backend
 * Mirrors web's profile API integration for mobile.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiUrl } from '@pnl/shared/utils';

export interface UserProfile {
  walletAddress: string;
  username?: string;
  profilePhotoUrl?: string;
  bio?: string;
  email?: string;
  twitter?: string;
  reputationScore: number;
  totalPredictions: number;
  correctPredictions: number;
  projectsCreated: number;
  successfulProjects: number;
  followerCount: number;
  followingCount: number;
  favoriteMarkets: string[];
  createdAt: string;
  updatedAt: string;
}

interface UseProfileReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  /** True when profile exists but has no username (needs onboarding) */
  needsSetup: boolean;
  refresh: () => void;
  updateProfile: (data: ProfileUpdateData) => Promise<boolean>;
  isUpdating: boolean;
  checkUsername: (username: string) => Promise<{ available: boolean; error?: string }>;
  generateUsername: () => Promise<string>;
}

export interface ProfileUpdateData {
  username?: string;
  profilePhotoUrl?: string;
  bio?: string;
  twitter?: string;
  email?: string;
}

// Username generation — same prefixes/suffixes as web
const usernamePrefixes = [
  'Cosmic', 'Stellar', 'Nebula', 'Quantum', 'Astral', 'Galactic',
  'Void', 'Pulsar', 'Nova', 'Meteor', 'Solar', 'Lunar', 'Celestial',
  'Comet', 'Asteroid', 'Photon', 'Quasar', 'Supernova', 'Orbit',
  'Eclipse', 'Zenith', 'Aurora', 'Stardust', 'Plasma', 'Gravity',
];

const usernameSuffixes = [
  'Voyager', 'Pioneer', 'Explorer', 'Seeker', 'Wanderer', 'Traveler',
  'Navigator', 'Dreamer', 'Hunter', 'Rider', 'Mage', 'Sage', 'Legend',
  'Keeper', 'Guardian', 'Walker', 'Runner', 'Drifter', 'Chaser',
  'Observer', 'Watcher', 'Master', 'Knight', 'Phantom', 'Spirit',
];

export const COSMIC_AVATARS = [
  { id: 'nebula', name: 'Nebula', path: '/cosmic-avatars/nebula.svg' },
  { id: 'galaxy', name: 'Galaxy', path: '/cosmic-avatars/galaxy.svg' },
  { id: 'supernova', name: 'Supernova', path: '/cosmic-avatars/supernova.svg' },
  { id: 'pulsar', name: 'Pulsar', path: '/cosmic-avatars/pulsar.svg' },
  { id: 'blackhole', name: 'Black Hole', path: '/cosmic-avatars/blackhole.svg' },
  { id: 'comet', name: 'Comet', path: '/cosmic-avatars/comet.svg' },
  { id: 'starcluster', name: 'Star Cluster', path: '/cosmic-avatars/starcluster.svg' },
  { id: 'moonphase', name: 'Moon Phase', path: '/cosmic-avatars/moonphase.svg' },
];

/** Resolve a cosmic avatar path to a full URL for mobile */
export function resolveAvatarUrl(path: string): string {
  if (!path) return '';
  // Already a full URL (IPFS, https, etc.)
  if (path.startsWith('http')) return path;
  // Relative path → prepend web app URL
  return `https://pnl.market${path}`;
}

export function useProfile(walletAddress: string | null): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!walletAddress) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/profile/${walletAddress}`));
      const result = await res.json();

      if (result.success && result.data) {
        setProfile(result.data);
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  // Fetch on mount / wallet change
  useEffect(() => {
    if (walletAddress && walletAddress !== fetchedRef.current) {
      fetchedRef.current = walletAddress;
      fetchProfile();
    } else if (!walletAddress) {
      setProfile(null);
      fetchedRef.current = null;
    }
  }, [walletAddress, fetchProfile]);

  const needsSetup = !!profile && !profile.username;

  const updateProfile = useCallback(
    async (data: ProfileUpdateData): Promise<boolean> => {
      if (!walletAddress) return false;
      setIsUpdating(true);

      try {
        const { authenticatedPost } = await import('@pnl/shared/utils');
        const result = await authenticatedPost('/api/profile/update', { walletAddress, ...data });

        if (result.success) {
          // Refresh profile
          await fetchProfile();
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [walletAddress, fetchProfile],
  );

  const checkUsername = useCallback(
    async (username: string): Promise<{ available: boolean; error?: string }> => {
      try {
        const res = await fetch(
          apiUrl(`/api/profile/check-username?username=${encodeURIComponent(username)}`),
        );
        const data = await res.json();
        return { available: data.available ?? false, error: data.error };
      } catch {
        return { available: true }; // Assume available on error
      }
    },
    [],
  );

  const generateUsername = useCallback(async (): Promise<string> => {
    let attempts = 0;
    while (attempts < 10) {
      const prefix = usernamePrefixes[Math.floor(Math.random() * usernamePrefixes.length)];
      const suffix = usernameSuffixes[Math.floor(Math.random() * usernameSuffixes.length)];
      const num = Math.floor(Math.random() * 999);
      const candidate = `${prefix}${suffix}${num}`;

      const { available } = await checkUsername(candidate);
      if (available) return candidate;
      attempts++;
    }
    return `CosmicUser${Date.now().toString().slice(-6)}`;
  }, [checkUsername]);

  return {
    profile,
    isLoading,
    error,
    needsSetup,
    refresh: fetchProfile,
    updateProfile,
    isUpdating,
    checkUsername,
    generateUsername,
  };
}
