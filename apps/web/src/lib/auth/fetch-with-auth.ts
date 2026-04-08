/**
 * Web client authenticated fetch.
 * Automatically attaches Privy Bearer token to requests.
 * Drop-in replacement for fetch() on API calls.
 *
 * Usage: Replace fetch('/api/...', opts) with authFetch('/api/...', opts)
 */

import { getAccessToken } from '@pnl/shared/utils';

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  // Attach Privy token if available
  try {
    const token = await getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {
    // No token available — proceed without auth
  }

  return fetch(url, { ...options, headers });
}
