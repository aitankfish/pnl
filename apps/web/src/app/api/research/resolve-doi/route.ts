/**
 * POST /api/research/resolve-doi
 *
 * Paste-a-DOI autofill. Accepts a bare DOI, a doi.org link, or a Zenodo record
 * URL; resolves it via DOI content-negotiation (one endpoint that covers both
 * Crossref and DataCite/Zenodo) and returns the metadata the create form needs
 * to prefill: title, authors, abstract, published date, and the canonical
 * landing URL. Read-only — no DB writes, no auth required (it only reads public
 * scholarly metadata), but rate-limited per wallet/IP to be polite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeDoi, stripAbstract } from '@/lib/doi';
import { isSafeExternalUrl } from '@/lib/safe-url';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const RESOLVE_TIMEOUT_MS = 8000;

export async function POST(request: NextRequest) {
  try {
    // Loose rate limit keyed on IP — this hits a third-party API.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const limited = await checkRateLimit(`research:resolve-doi:${ip}`, 20, 60_000);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const input = typeof body?.input === 'string' ? body.input : '';

    const normalized = normalizeDoi(input);
    if (!normalized) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Couldn't find a DOI in that. Paste a DOI (e.g. 10.5281/zenodo.123), a doi.org link, an arXiv link, or a Zenodo record URL.",
        },
        { status: 400 },
      );
    }

    const { doi, doiUrl } = normalized;

    // Resolve against the registry APIs directly — this is far more reliable
    // than doi.org content-negotiation, which arXiv answers with HTML and some
    // Crossref DOIs reject outright. Crossref covers journals/conferences/most
    // preprint servers; DataCite covers Zenodo, arXiv, Figshare, Dryad. Try
    // Crossref first, fall back to DataCite, so any DOI registrar is covered.
    const meta =
      (await fetchCrossref(doi)) ?? (await fetchDataCite(doi));

    if (!meta) {
      return NextResponse.json(
        {
          success: false,
          error: `Couldn't find metadata for DOI ${doi}. Double-check it, or fill the fields in manually.`,
        },
        { status: 404 },
      );
    }

    const summary = stripAbstract(meta.abstractHtml).slice(0, 500);
    // Prefer the publisher/landing page; fall back to the canonical doi.org URL.
    const landing =
      meta.url && isSafeExternalUrl(meta.url) ? meta.url : doiUrl;

    return NextResponse.json({
      success: true,
      data: {
        doi,
        externalUrl: landing,
        doiUrl,
        title: meta.title,
        authorName: meta.authorName,
        summary,
        publishedDate: meta.publishedDate,
        source: meta.container,
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    logger.error('[resolve-doi] failed', error as any);
    return NextResponse.json(
      {
        success: false,
        error: aborted
          ? 'The DOI registry took too long to respond. Try again.'
          : 'Failed to resolve that DOI.',
      },
      { status: aborted ? 504 : 500 },
    );
  }
}

interface ResolvedMeta {
  title: string;
  authorName: string;
  abstractHtml: string;
  publishedDate: string | null;
  url: string | null;
  container: string | null;
}

async function timedFetch(url: string, headers: Record<string, string>): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': 'PNL/1.0 (research paper import)', ...headers },
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Crossref — journals, conferences, books, and most preprint servers.
async function fetchCrossref(doi: string): Promise<ResolvedMeta | null> {
  const res = await timedFetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { Accept: 'application/json' },
  );
  if (!res || !res.ok) return null;
  const json: any = await res.json().catch(() => null);
  const m = json?.message;
  if (!m) return null;

  return {
    title: firstString(m.title).slice(0, 255),
    authorName: joinAuthors(
      (Array.isArray(m.author) ? m.author : []).map((a: any) =>
        a?.literal || `${a?.given || ''} ${a?.family || ''}`.trim(),
      ),
    ),
    abstractHtml: typeof m.abstract === 'string' ? m.abstract : '',
    publishedDate: dateFromParts(
      m.issued?.['date-parts']?.[0] ||
        m.published?.['date-parts']?.[0] ||
        m['published-online']?.['date-parts']?.[0],
    ),
    url: typeof m.URL === 'string' ? m.URL : null,
    container: firstString(m['container-title']) || (m.publisher ? String(m.publisher) : null),
  };
}

// DataCite — Zenodo, arXiv, Figshare, Dryad, and other data/preprint repos.
async function fetchDataCite(doi: string): Promise<ResolvedMeta | null> {
  const res = await timedFetch(
    `https://api.datacite.org/dois/${encodeURIComponent(doi)}`,
    { Accept: 'application/json' },
  );
  if (!res || !res.ok) return null;
  const json: any = await res.json().catch(() => null);
  const a = json?.data?.attributes;
  if (!a) return null;

  const titles = Array.isArray(a.titles) ? a.titles : [];
  const creators = Array.isArray(a.creators) ? a.creators : [];
  const descriptions = Array.isArray(a.descriptions) ? a.descriptions : [];
  const abstract =
    descriptions.find((d: any) => d?.descriptionType === 'Abstract')?.description ||
    descriptions[0]?.description ||
    '';
  const issued =
    (Array.isArray(a.dates) ? a.dates : []).find((d: any) => d?.dateType === 'Issued')?.date ||
    (a.publicationYear ? String(a.publicationYear) : null);

  return {
    title: String(titles[0]?.title || '').slice(0, 255),
    authorName: joinAuthors(
      creators.map((c: any) => {
        const given = c?.givenName ? String(c.givenName) : '';
        const family = c?.familyName ? String(c.familyName) : '';
        const combined = `${given} ${family}`.trim();
        return combined || (c?.name ? String(c.name) : '');
      }),
    ),
    abstractHtml: typeof abstract === 'string' ? abstract : '',
    publishedDate: typeof issued === 'string' ? normalizeIssued(issued) : null,
    url: typeof a.url === 'string' ? a.url : null,
    container: a.publisher ? String(a.publisher) : null,
  };
}

function firstString(v: any): string {
  if (Array.isArray(v)) return v[0] ? String(v[0]) : '';
  return v ? String(v) : '';
}

function joinAuthors(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return '';
  const joined = clean.join(', ');
  // Keep under the 120-char author-name cap; collapse a long list to et al.
  if (joined.length <= 120) return joined;
  return `${clean[0]} et al.`.slice(0, 120);
}

function dateFromParts(parts: any): string | null {
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const [y, m, d] = parts;
  if (!y) return null;
  const mm = m ? String(m).padStart(2, '0') : '01';
  const dd = d ? String(d).padStart(2, '0') : '01';
  return `${y}-${mm}-${dd}`;
}

// DataCite dates can be a year, YYYY-MM, or a full ISO date — normalize to a
// YYYY-MM-DD prefix where possible.
function normalizeIssued(raw: string): string {
  const m = raw.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return raw;
  return `${m[1]}-${m[2] || '01'}-${m[3] || '01'}`;
}
