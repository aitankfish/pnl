/**
 * Server-side market data fetcher used by both layout.tsx (for OG metadata)
 * and page.tsx (for the SSR'd initial state of the market detail page).
 *
 * `cache()` from React deduplicates the underlying fetch within a single
 * server render — so generateMetadata + the page itself share one network
 * round-trip. This also benefits from Next's data cache (`next.revalidate: 60`),
 * which dedupes across requests within the revalidation window.
 *
 * Keep this module dependency-light — it runs in the React Server Components
 * graph and any heavy import here would balloon the server bundle.
 */
import { cache } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';
// Strip a trailing `/api` so we don't double-stack it: the fetch path below
// already appends `/api/markets/...`. Some envs set NEXT_PUBLIC_API_URL with a
// trailing `/api` (e.g. http://localhost:3000/api), which would otherwise
// produce `/api/api/markets/<id>` → 404.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || BASE_URL).replace(/\/api\/?$/, '');

// Loose shape — the page uses a much richer client interface, but the
// server side only needs what's safe to serialize and pre-render.
export interface ServerMarketData {
  // Basic identity
  id: string;
  marketAddress: string;
  name: string;
  description: string;
  category?: string;
  stage?: string;
  tokenSymbol: string;
  // Lightweight fields used during SSR
  projectImageUrl?: string;
  status?: string;
  yesPercentage?: number;
  totalParticipants?: number;
  // Allow any extra fields — page.tsx will use `MarketDetails` shape and
  // simply seed its state from this. Unknown fields are safely passed.
  [key: string]: any;
}

export const getMarket = cache(async (id: string): Promise<ServerMarketData | null> => {
  try {
    const res = await fetch(`${API_URL}/api/markets/${id}`, {
      // Share with Next's data cache — within 60s, additional renders reuse
      // the response without hitting the API. The Redis cache on the API
      // route itself catches anything beyond that window.
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`[market/_data] /api/markets/${id} -> ${res.status}`);
      return null;
    }
    const json = await res.json();
    return json.success ? (json.data as ServerMarketData) : null;
  } catch (err) {
    console.error(`[market/_data] fetch failed for ${id}:`, err);
    return null;
  }
});
