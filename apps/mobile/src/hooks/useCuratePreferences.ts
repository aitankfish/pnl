import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pnl/curate_preferences';

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
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(raw) });
        } catch {}
      }
      setIsLoaded(true);
    });
  }, []);

  const updatePreferences = useCallback((partial: Partial<CuratePreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { preferences, isLoaded, updatePreferences, resetToDefaults };
}
