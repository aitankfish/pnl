/**
 * Centralized SWR Configuration
 * Provides optimized caching and data fetching settings
 */

import { SWRConfiguration } from 'swr';

/**
 * Default fetcher with error handling
 */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error('API request failed');
    (error as any).status = res.status;
    try {
      const json = await res.json();
      (error as any).info = json;
    } catch {
      (error as any).info = { message: res.statusText };
    }
    throw error;
  }

  return res.json();
}

/**
 * POST fetcher for mutations
 */
export async function postFetcher<T>(url: string, data: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = new Error('API request failed');
    (error as any).status = res.status;
    try {
      const json = await res.json();
      (error as any).info = json;
    } catch {
      (error as any).info = { message: res.statusText };
    }
    throw error;
  }

  return res.json();
}

/**
 * Default SWR configuration for the app
 */
export const swrConfig: SWRConfiguration = {
  fetcher,
  // Revalidate on focus (user returns to tab)
  revalidateOnFocus: true,
  // Revalidate on reconnect (network comes back)
  revalidateOnReconnect: true,
  // Don't revalidate on mount if data exists
  revalidateIfStale: true,
  // Dedupe requests within 2 seconds
  dedupingInterval: 2000,
  // Focus throttle to prevent excessive revalidation
  focusThrottleInterval: 5000,
  // Keep previous data while revalidating
  keepPreviousData: true,
  // Error retry configuration
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  // Suspense mode disabled by default
  suspense: false,
  // Custom error handler
  onError: (error, key) => {
    // Don't log 404s as they're often expected
    if ((error as any).status !== 404) {
      console.error(`SWR Error for ${key}:`, error);
    }
  },
};

/**
 * Configuration for frequently updating data (markets, prices)
 */
export const realtimeConfig: SWRConfiguration = {
  ...swrConfig,
  // Refresh every 10 seconds for real-time data
  refreshInterval: 10000,
  // Dedupe within 1 second for real-time
  dedupingInterval: 1000,
  // Always show fresh data
  revalidateIfStale: true,
};

/**
 * Configuration for static data (user profiles, project details)
 */
export const staticConfig: SWRConfiguration = {
  ...swrConfig,
  // Don't auto-refresh static data
  refreshInterval: 0,
  // Longer dedup interval
  dedupingInterval: 60000,
  // Don't revalidate on focus for static data
  revalidateOnFocus: false,
};

/**
 * Configuration for user-specific data
 */
export const userConfig: SWRConfiguration = {
  ...swrConfig,
  // Refresh every 30 seconds for user data
  refreshInterval: 30000,
  // Standard dedup
  dedupingInterval: 5000,
  // Revalidate on focus to catch changes
  revalidateOnFocus: true,
};

/**
 * API Response types
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
  error?: string;
}
