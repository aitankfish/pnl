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
  revalidateOnFocus: false,       // Disabled — prevents burst refetches on mobile app resume
  revalidateOnReconnect: true,
  revalidateIfStale: true,
  dedupingInterval: 5000,          // Increased from 2s to 5s — reduces duplicate requests
  focusThrottleInterval: 10000,    // Increased from 5s to 10s
  keepPreviousData: true,
  errorRetryCount: 2,              // Reduced from 3 — faster failure
  errorRetryInterval: 2000,        // Increased from 1s — less retry spam
  suspense: false,
  onError: () => {},               // Silent — errors handled per-hook
};

export const realtimeConfig: SWRConfiguration = { ...swrConfig, refreshInterval: 15000, dedupingInterval: 5000 };
export const staticConfig: SWRConfiguration = { ...swrConfig, refreshInterval: 0, dedupingInterval: 60000 };
export const userConfig: SWRConfiguration = { ...swrConfig, refreshInterval: 30000, dedupingInterval: 10000 };

export interface ApiResponse<T> { success: boolean; data?: T; error?: string; details?: string; }
export interface PaginatedResponse<T> { success: boolean; data?: { items: T[]; total: number; page: number; limit: number; hasMore: boolean; }; error?: string; }
