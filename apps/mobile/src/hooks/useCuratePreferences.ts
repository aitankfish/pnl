import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'pnl_curate_preferences';

export type CurateSortOption = 'most_active' | 'biggest_pools' | 'most_favorited' | 'newest' | 'ending_soonest';
export type TimeRange = 'all' | '24h' | '7d' | '30d';

export interface CuratePreferences {
  categories: string[];
  sortBy: CurateSortOption;
  timeRange: TimeRange;
}

export const DEFAULT_PREFERENCES: CuratePreferences = {
  categories: ['All'],
  sortBy: 'most_active',
  timeRange: 'all',
};

export function useCuratePreferences() {
  const [preferences, setPreferences] = useState<CuratePreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = SecureStore.getItem(STORAGE_KEY);
      if (raw) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(raw) });
      }
    } catch {}
    setIsLoaded(true);
  }, []);

  const updatePreferences = useCallback((partial: Partial<CuratePreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      try { SecureStore.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    try { SecureStore.deleteItemAsync(STORAGE_KEY); } catch {}
  }, []);

  return { preferences, isLoaded, updatePreferences, resetToDefaults };
}
