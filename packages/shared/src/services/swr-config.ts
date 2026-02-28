/**
 * SWR Configuration (shared)
 */

import { SWRConfiguration } from 'swr';
import { apiUrl } from '../utils/api';

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(apiUrl(url));
  if (!res.ok) {
    const error = new Error('API request failed');
    (error as any).status = res.status;
    try { (error as any).info = await res.json(); } catch { (error as any).info = { message: res.statusText }; }
    throw error;
  }
  return res.json();
}

export async function postFetcher<T>(url: string, data: any): Promise<T> {
  const res = await fetch(apiUrl(url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) {
    const error = new Error('API request failed');
    (error as any).status = res.status;
    try { (error as any).info = await res.json(); } catch { (error as any).info = { message: res.statusText }; }
    throw error;
  }
  return res.json();
}

export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  revalidateIfStale: true,
  dedupingInterval: 2000,
  focusThrottleInterval: 5000,
  keepPreviousData: true,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  suspense: false,
  onError: (error, key) => {
    if ((error as any).status !== 404) console.error(`SWR Error for ${key}:`, error);
  },
};

export const realtimeConfig: SWRConfiguration = { ...swrConfig, refreshInterval: 10000, dedupingInterval: 1000, revalidateIfStale: true };
export const staticConfig: SWRConfiguration = { ...swrConfig, refreshInterval: 0, dedupingInterval: 60000, revalidateOnFocus: false };
export const userConfig: SWRConfiguration = { ...swrConfig, refreshInterval: 30000, dedupingInterval: 5000, revalidateOnFocus: true };

export interface ApiResponse<T> { success: boolean; data?: T; error?: string; details?: string; }
export interface PaginatedResponse<T> { success: boolean; data?: { items: T[]; total: number; page: number; limit: number; hasMore: boolean; }; error?: string; }
