/**
 * Paper stats aggregator — the work's real-world reach, pulled live from the
 * open scholarly graph and cached.
 *
 * Registrar-agnostic: PNL doesn't compute these, it READS them from whoever the
 * paper was published with. Works for any DOI — minted on PNL (via Zenodo) or
 * pasted in from anywhere. Free sources only:
 *   - OpenAlex   → citations (cited_by_count). No key, the universal layer.
 *   - Crossref   → citations fallback (is-referenced-by-count).
 *   - DataCite   → downloads / views / citations (Make-Data-Count usage).
 *   - Zenodo     → downloads / views (richer than DataCite for Zenodo records).
 *
 * Guardrail: these are the OUTSIDE world's signal on the work — distinct from
 * PNL-internal vote/holder stats, which stay masked. External reach is fair to
 * show; herd behavior on PNL is not.
 */

import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

// Stats move slowly; cache hard to stay friendly to the free APIs.
const CACHE_SECONDS = 12 * 60 * 60;
// Politeness: OpenAlex/Crossref give a faster "polite pool" when you identify.
const POLITE = process.env.SCHOLARLY_CONTACT_EMAIL || 'research@pnl.fun';

export interface PaperStats {
  doi: string;
  citations: number | null;
  downloads: number | null;
  views: number | null;
  openAccess: boolean | null;
  sources: string[];
  updatedAt: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': `PNL-Research/1.0 (mailto:${POLITE})`, Accept: 'application/json', ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function zenodoRecidFromDoi(doi: string): string | null {
  const m = doi.match(/10\.5281\/zenodo\.(\d+)/i);
  return m ? m[1] : null;
}

async function fromOpenAlex(doi: string) {
  const data = await fetchJson(`https://api.openalex.org/works/doi:${doi}?mailto=${encodeURIComponent(POLITE)}`);
  if (!data) return null;
  return {
    citations: typeof data.cited_by_count === 'number' ? data.cited_by_count : null,
    openAccess: typeof data.open_access?.is_oa === 'boolean' ? data.open_access.is_oa : null,
  };
}

async function fromCrossref(doi: string) {
  const data = await fetchJson(`https://api.crossref.org/works/${doi}?mailto=${encodeURIComponent(POLITE)}`);
  const n = data?.message?.['is-referenced-by-count'];
  return typeof n === 'number' ? n : null;
}

async function fromDataCite(doi: string) {
  // DOIs go in the path raw (slashes intact) — don't URL-encode them.
  const data = await fetchJson(`https://api.datacite.org/dois/${doi}`);
  const a = data?.data?.attributes;
  if (!a) return null;
  return {
    downloads: typeof a.downloadCount === 'number' ? a.downloadCount : null,
    views: typeof a.viewCount === 'number' ? a.viewCount : null,
    citations: typeof a.citationCount === 'number' ? a.citationCount : null,
  };
}

async function fromZenodo(recid: string) {
  const data = await fetchJson(`https://zenodo.org/api/records/${recid}`);
  const s = data?.stats;
  if (!s) return null;
  return {
    downloads: typeof s.downloads === 'number' ? Math.round(s.downloads) : null,
    views: typeof s.views === 'number' ? Math.round(s.views) : null,
  };
}

/**
 * Aggregate a paper's external stats by DOI. Returns null only when there's no
 * usable DOI. Individual source failures degrade to null fields, never throw.
 */
export async function getPaperStats(rawDoi: string | null | undefined): Promise<PaperStats | null> {
  const doi = (rawDoi || '').trim().toLowerCase();
  if (!doi || !doi.startsWith('10.')) return null;

  const cacheKey = prefixKey(`paperstats:${doi}`);
  try {
    const cached = await getRedisClient().get(cacheKey);
    if (cached) return JSON.parse(cached) as PaperStats;
  } catch {
    // Redis down — just compute live.
  }

  const recid = zenodoRecidFromDoi(doi);
  const [openalex, crossrefCites, datacite, zenodo] = await Promise.all([
    fromOpenAlex(doi),
    fromCrossref(doi),
    fromDataCite(doi),
    recid ? fromZenodo(recid) : Promise.resolve(null),
  ]);

  const sources = new Set<string>();

  // Citations — prefer OpenAlex (most complete), then Crossref, then DataCite.
  let citations: number | null = null;
  if (openalex?.citations != null) {
    citations = openalex.citations;
    sources.add('OpenAlex');
  } else if (crossrefCites != null) {
    citations = crossrefCites;
    sources.add('Crossref');
  } else if (datacite?.citations != null) {
    citations = datacite.citations;
    sources.add('DataCite');
  }

  // Downloads / views — Zenodo is richer for its own records; else DataCite.
  let downloads: number | null = null;
  let views: number | null = null;
  if (zenodo) {
    downloads = zenodo.downloads;
    views = zenodo.views;
    if (downloads != null || views != null) sources.add('Zenodo');
  }
  if (downloads == null && datacite?.downloads != null) {
    downloads = datacite.downloads;
    sources.add('DataCite');
  }
  if (views == null && datacite?.views != null) {
    views = datacite.views;
    sources.add('DataCite');
  }

  const stats: PaperStats = {
    doi,
    citations,
    downloads,
    views,
    openAccess: openalex?.openAccess ?? null,
    sources: [...sources],
    updatedAt: new Date().toISOString(),
  };

  try {
    await getRedisClient().setex(cacheKey, CACHE_SECONDS, JSON.stringify(stats));
  } catch {
    // Best-effort cache.
  }

  logger.info('[paper-stats] aggregated', { doi, sources: stats.sources, citations, downloads, views });
  return stats;
}
