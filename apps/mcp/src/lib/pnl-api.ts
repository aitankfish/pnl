// ─── PNL public read API client ──────────────────────────────────
//
// Thin wrappers over the two public read endpoints documented at
// https://docs.pnl.market/docs/build/public-api. The MCP server never
// holds keys, so this module is fetch-only.
//
// Base URL is configurable via PNL_API_BASE_URL — defaults to the live
// site. Tests / staging / devnet pointed deployments can override.

const DEFAULT_BASE_URL = 'https://pnl.market';

function getBaseUrl(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return DEFAULT_BASE_URL;
  // Strip trailing slash so we can append paths cleanly.
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export type MarketStatus = 'active' | 'yesWins' | 'noWins' | 'expired' | 'refund' | 'all';

// Fields confirmed against live /api/markets/list and /api/markets/<id>
// responses. The API wraps everything in { success, data: ... } — that's
// stripped by fetchJson before tools see it.
export interface MarketSummary {
  id: string;
  name: string;
  description?: string;
  category?: string;
  stage?: string;
  tokenSymbol?: string;
  targetPool?: string;
  founderDisplayName?: string;
  founderUsername?: string;
  founderWallet?: string;
  totalParticipants?: number;
  yesPercentage?: number | null;
  noPercentage?: number | null;
  // Pool fields — present on /api/markets/<id>, absent on /api/markets/list
  // (list uses totalYesStake / totalNoStake / poolBalance instead).
  yesPool?: number | null;
  noPool?: number | null;
  totalYesStake?: number | null;
  totalNoStake?: number | null;
  poolBalance?: string | number | null;
  poolProgressPercentage?: number;
  status?: string;
  displayStatus?: string;
  phase?: string;
  resolution?: string;
  timeLeft?: string;
  expiryTime?: string;
  marketAddress?: string;
  pumpFunTokenAddress?: string | null;
  tokenMint?: string | null;
  projectImageUrl?: string | null;
}

export interface MarketListResponse {
  markets: MarketSummary[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  totalPages?: number;
}

// The live API always wraps responses as { success: boolean, data: T }.
// We unwrap here so each tool sees the payload it cares about.
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      // Identify ourselves so the rate limiter can see who's calling.
      'User-Agent': 'pnl-mcp-server/0.1.0 (+https://docs.pnl.market)',
    },
  });
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(
      `PNL API ${res.status} ${res.statusText} for ${url}${body ? ` — ${body.slice(0, 200)}` : ''}`,
    );
  }
  const json = (await res.json()) as ApiEnvelope<T> | T;
  // The API wraps everything in {success, data}. If we see that shape,
  // unwrap; otherwise pass through (for future endpoints that don't wrap).
  if (
    typeof json === 'object' &&
    json !== null &&
    'success' in (json as object) &&
    'data' in (json as object)
  ) {
    const env = json as ApiEnvelope<T>;
    if (!env.success) {
      throw new Error(`PNL API returned success=false for ${url}${env.error ? ` — ${env.error}` : ''}`);
    }
    return env.data;
  }
  return json as T;
}

/**
 * Browse live (or historical) conviction markets.
 *
 * Wraps GET /api/markets/list with the documented query params. Returns
 * the same payload the API returns — the tool layer formats it for the
 * agent. Public, no auth, IP-rate-limited 60/min by the server.
 */
export async function browseMarkets(params: {
  status?: MarketStatus;
  page?: number;
  limit?: number;
}): Promise<MarketListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const url = `${getBaseUrl()}/api/markets/list${qs.toString() ? `?${qs.toString()}` : ''}`;
  return fetchJson<MarketListResponse>(url);
}

/**
 * Fetch a single market by id.
 *
 * Wraps GET /api/markets/<id>. Returns the full market object — name,
 * description, founder, pools, YES%, status, expiry, the on-chain market
 * address, and any computed display fields.
 */
export async function getMarket(id: string): Promise<MarketSummary> {
  if (!id) throw new Error('marketId is required');
  // Encode just in case someone passes a market address that contains
  // characters that need encoding (unlikely for base58 but cheap to be safe).
  const url = `${getBaseUrl()}/api/markets/${encodeURIComponent(id)}`;
  return fetchJson<MarketSummary>(url);
}

/**
 * Public URL the user can open in a browser to view a market. Used to
 * thread back into the tool output so agents can hand the user a link.
 */
export function marketUrl(id: string): string {
  return `${getBaseUrl()}/market/${encodeURIComponent(id)}`;
}
