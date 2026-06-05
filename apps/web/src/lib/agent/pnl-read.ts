// Read-only data access for PNL agents (concierge + future house-agent tools).
//
// Fetch-only, no keys, no DB coupling. Hits the app's own public read API so
// callers get the exact display-ready payloads the browse UI uses (gateway
// URLs, display status, TTL-cached at the source). Shared by the concierge
// route; the hosted MCP route keeps its own inline copy for now.

const SERVER_TAG = 'pnl-concierge/0.1.0 (+https://docs.pnl.market)';

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = raw && raw.length > 0 ? raw : 'https://pnl.market';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${siteUrl()}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': SERVER_TAG },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PNL API ${res.status} ${res.statusText} on ${path}`);
  const json = (await res.json()) as Envelope<T> | T;
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    const env = json as Envelope<T>;
    if (!env.success) throw new Error(env.error || 'PNL API returned success: false');
    return env.data;
  }
  return json as T;
}

export interface MarketRaw {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  yesPercentage?: number | null;
  totalYesStake?: number | null;
  totalNoStake?: number | null;
  yesPool?: number | null;
  noPool?: number | null;
  poolBalance?: string | number | null;
  totalParticipants?: number;
  displayStatus?: string;
  status?: string;
  phase?: string;
  resolution?: string;
  timeLeft?: string;
  expiryTime?: string;
  founderUsername?: string;
  founderDisplayName?: string;
  marketAddress?: string;
  pumpFunTokenAddress?: string | null;
  tokenMint?: string | null;
}

export const MARKET_STATUSES = ['active', 'yesWins', 'noWins', 'expired', 'refund', 'all'] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];

// Units, confirmed against the live API:
//   - totalYesStake / totalNoStake: SOL, and only present on RESOLVED markets
//     (masked = null on active markets by design).
//   - poolBalance: lamports (string), present on every market.
// So the stake fields are summed as-is; poolBalance is divided by 1e9.
function poolSol(m: MarketRaw): number | null {
  const yes = m.totalYesStake ?? m.yesPool;
  const no = m.totalNoStake ?? m.noPool;
  if (yes != null || no != null) {
    return Number(((yes ?? 0) + (no ?? 0)).toFixed(4)); // already SOL
  }
  if (m.poolBalance != null) {
    const n = typeof m.poolBalance === 'string' ? Number(m.poolBalance) : m.poolBalance;
    if (Number.isFinite(n)) return Number((n / 1e9).toFixed(4)); // lamports -> SOL
  }
  return null;
}

// Compact, model-friendly projection — small token footprint, only what an
// agent needs to reason and cite. Raw payloads are large; we trim hard.
export interface MarketBrief {
  id: string;
  name: string;
  category: string | null;
  yesPercent: number | null;
  poolSol: number | null;
  participants: number | null;
  status: string;
  resolution: string | null;
  timeLeft: string | null;
  founder: string | null;
  marketAddress: string | null;
  tokenMint: string | null;
  url: string;
}

export function toBrief(m: MarketRaw): MarketBrief {
  const founder = m.founderDisplayName || (m.founderUsername ? `@${m.founderUsername}` : null);
  return {
    id: m.id,
    name: m.name ?? m.id,
    category: m.category ?? null,
    yesPercent: m.yesPercentage != null ? Math.round(m.yesPercentage) : null,
    poolSol: poolSol(m),
    participants: m.totalParticipants ?? null,
    status: m.displayStatus || m.status || 'unknown',
    resolution: m.resolution ?? null,
    timeLeft: m.timeLeft ?? null,
    founder,
    marketAddress: m.marketAddress ?? null,
    tokenMint: m.pumpFunTokenAddress ?? m.tokenMint ?? null,
    url: `${siteUrl()}/market/${encodeURIComponent(m.id)}`,
  };
}

export async function listMarkets(opts: {
  status?: MarketStatus;
  limit?: number;
  page?: number;
}): Promise<{ markets: MarketBrief[]; total: number | null; hasMore: boolean }> {
  const qs = new URLSearchParams({
    status: opts.status ?? 'active',
    limit: String(Math.min(50, Math.max(1, opts.limit ?? 10))),
    page: String(Math.max(1, opts.page ?? 1)),
  });
  const data = await apiGet<{ markets: MarketRaw[]; total?: number; hasMore?: boolean }>(
    `/api/markets/list?${qs.toString()}`,
  );
  return {
    markets: (data.markets ?? []).map(toBrief),
    total: data.total ?? null,
    hasMore: Boolean(data.hasMore),
  };
}

export async function getMarket(id: string): Promise<MarketBrief & { description: string | null }> {
  const m = await apiGet<MarketRaw>(`/api/markets/${encodeURIComponent(id)}`);
  return { ...toBrief(m), description: m.description ?? null };
}

// Keyword filter over a candidate set. There is no server-side search endpoint
// yet, so we pull a generous page and match name/category/description locally.
export async function searchMarkets(
  query: string,
  opts: { status?: MarketStatus; limit?: number } = {},
): Promise<MarketBrief[]> {
  const data = await apiGet<{ markets: MarketRaw[] }>(
    `/api/markets/list?status=${opts.status ?? 'all'}&limit=50&page=1`,
  );
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = (data.markets ?? [])
    .map((m) => {
      const hay = `${m.name ?? ''} ${m.category ?? ''} ${m.description ?? ''}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(15, Math.max(1, opts.limit ?? 8)));
  return scored.map((x) => toBrief(x.m));
}

export interface PlatformSnapshot {
  totalVotes: number;
  totalPoolSol: number;
  activeMarkets: number;
  resolvedMarkets: number;
  sampledMarkets: number;
  note: string;
}

export async function platformSnapshot(): Promise<PlatformSnapshot> {
  const data = await apiGet<{
    markets: MarketRaw[];
    platformStats?: { totalVotes?: number; totalPoolVolume?: number; activeMarkets?: number; resolvedMarkets?: number };
  }>(`/api/markets/list?status=all&limit=50&page=1`);
  const s = data.platformStats ?? {};
  return {
    totalVotes: s.totalVotes ?? 0,
    // totalPoolVolume is already denominated in SOL (not lamports).
    totalPoolSol: Number((s.totalPoolVolume ?? 0).toFixed(3)),
    activeMarkets: s.activeMarkets ?? 0,
    resolvedMarkets: s.resolvedMarkets ?? 0,
    sampledMarkets: (data.markets ?? []).length,
    note: 'Snapshot over the most recent markets, not the full historical total.',
  };
}

export type ActionKind = 'view' | 'vote' | 'claim' | 'pitch';

export function actionLink(kind: ActionKind, opts: { marketId?: string; side?: 'yes' | 'no'; amountSol?: number }): string {
  const base = siteUrl();
  switch (kind) {
    case 'pitch':
      return `${base}/create`;
    case 'view':
      return `${base}/market/${encodeURIComponent(opts.marketId ?? '')}`;
    case 'claim':
      return `${base}/market/${encodeURIComponent(opts.marketId ?? '')}?claim=1`;
    case 'vote': {
      const u = new URL(`${base}/market/${encodeURIComponent(opts.marketId ?? '')}`);
      if (opts.side) u.searchParams.set('vote', opts.side);
      if (opts.amountSol != null) u.searchParams.set('amount', String(opts.amountSol));
      return u.toString();
    }
  }
}
