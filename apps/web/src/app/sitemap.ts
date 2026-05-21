import type { MetadataRoute } from 'next';

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://pnl.market'
).replace(/\/$/, '');

// Routes that are user-facing and safe to surface to crawlers. Excludes:
//   /admin, /api/*, /debug, /test  — internal or auth-gated
//   /profile, /wallet, /notifications — user-specific, no shared URL
//   /market/[id] is added dynamically below.
const STATIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/',           changeFrequency: 'daily',  priority: 1.0 },
  { path: '/browse',     changeFrequency: 'hourly', priority: 0.9 },
  { path: '/launchpad',  changeFrequency: 'hourly', priority: 0.9 },
  { path: '/whitepaper', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/create',     changeFrequency: 'monthly', priority: 0.6 },
  { path: '/launched',   changeFrequency: 'hourly', priority: 0.7 },
  { path: '/research',   changeFrequency: 'weekly', priority: 0.6 },
  { path: '/how-to-buy', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacy',    changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms',      changeFrequency: 'yearly', priority: 0.2 },
];

async function fetchMarketUrls(): Promise<MetadataRoute.Sitemap> {
  // Pull live markets so each /market/[id] is independently crawlable.
  // Best-effort: failures here must not break the sitemap response.
  try {
    const res = await fetch(`${BASE_URL}/api/markets/list?status=all&limit=500`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success?: boolean;
      data?: { markets?: Array<{ id?: string; lastSyncedAt?: string }> };
    };
    if (!json?.success) return [];
    const markets = json.data?.markets ?? [];
    return markets
      .filter((m) => typeof m.id === 'string')
      .map((m) => ({
        url: `${BASE_URL}/market/${m.id}`,
        lastModified: m.lastSyncedAt ? new Date(m.lastSyncedAt) : new Date(),
        changeFrequency: 'hourly' as const,
        priority: 0.7,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
  const marketEntries = await fetchMarketUrls();
  return [...staticEntries, ...marketEntries];
}
