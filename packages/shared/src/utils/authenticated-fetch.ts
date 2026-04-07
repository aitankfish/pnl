/**
 * Authenticated Fetch Utility
 * Wraps fetch calls with Privy access token for API authentication.
 * Used by mobile + web clients for wallet-authenticated API calls.
 */

import { apiUrl } from './api';

type GetAccessToken = () => Promise<string | null>;

let _getAccessToken: GetAccessToken | null = null;

/**
 * Set the access token provider (call once during app init)
 */
export function setAccessTokenProvider(provider: GetAccessToken) {
  _getAccessToken = provider;
}

/**
 * Get the current access token (if provider is set)
 */
export async function getAccessToken(): Promise<string | null> {
  if (!_getAccessToken) return null;
  try {
    return await _getAccessToken();
  } catch {
    return null;
  }
}

/**
 * Fetch with authentication header.
 * Falls back to unauthenticated if no token available.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);

  // Add auth token if available
  if (_getAccessToken) {
    try {
      const token = await _getAccessToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {
      // Silently fall back to unauthenticated
    }
  }

  return fetch(apiUrl(url), {
    ...options,
    headers,
  });
}

/**
 * Authenticated POST with JSON body
 */
export async function authenticatedPost<T = any>(
  url: string,
  body: Record<string, any>,
): Promise<T> {
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
