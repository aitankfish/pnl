/**
 * /research/[id]/code/search?q=<query>
 *
 * Code-search results inside the linked repo. Pure server component —
 * the form posts back to this same URL with the query as `?q=`. We
 * never search per-keystroke because GitHub's search-code endpoint is
 * tightly rate-limited (30/min authenticated).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl } from '@/lib/github';
import { CodeSubnav } from '@/components/research/CodeSubnav';
import { CodeSearchInput } from '@/components/research/CodeSearchInput';

export const dynamic = 'force-dynamic';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

const PAPER_BG = '#fbfaf6';
const INK = '#0d0d0d';
const INK_DIM = 'rgba(13,13,13,0.62)';
const INK_FAINT = 'rgba(13,13,13,0.35)';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}

export const metadata = { title: 'Search code · PNL' };

export default async function CodeSearchPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const q = (sp.q || '').trim();

  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const paper = await ResearchPaper.findById(id).lean<any>();
  if (!paper || paper.status !== 'active') notFound();
  if (!paper.githubUrl) notFound();

  const parsed = parseRepoFromUrl(paper.githubUrl);
  if (!parsed) notFound();

  // Only fetch when there's actually a query — saves a round-trip on
  // first landing and avoids burning rate limit on empty queries.
  let kind: 'idle' | 'ok' | 'auth-required' | 'rate-limited' | 'error' = 'idle';
  let items: any[] = [];
  let total = 0;
  let incomplete = false;

  if (q) {
    const ghQuery = encodeURIComponent(
      `${q} repo:${parsed.owner}/${parsed.repo}`,
    );
    const result = await ghCachedFetch<any>(
      `/search/code?q=${ghQuery}&per_page=30`,
      {
        cacheKey: `code-search:${parsed.owner}/${parsed.repo}:${q.toLowerCase()}`,
        ttlSeconds: 60,
        accept: 'application/vnd.github.text-match+json',
      },
    );

    if (result.kind === 'ok') {
      kind = 'ok';
      items = result.data.items || [];
      total = result.data.total_count || 0;
      incomplete = !!result.data.incomplete_results;
    } else if (result.kind === 'rate-limited') {
      kind = 'rate-limited';
    } else if (
      result.kind === 'error' &&
      (result as any).status === 401
    ) {
      kind = 'auth-required';
    } else {
      kind = 'error';
    }
  }

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-4xl mx-auto pt-8 sm:pt-12">
          <Link
            href={`/research/${id}/code`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to the code overview
          </Link>

          <header className="mb-6">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-2"
              style={{ color: AMBER }}
            >
              github.com/{parsed.owner}/{parsed.repo}
            </p>
            <h1
              className="leading-[1.05] mb-4"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
                letterSpacing: '-0.005em',
              }}
            >
              Search the code
            </h1>
          </header>

          <CodeSubnav paperId={id} />

          {/* Search input — reads / writes ?q= */}
          <CodeSearchInput paperId={id} initialQuery={q} />

          {/* Results / states */}
          <div className="mt-6">
            {kind === 'idle' && <IdleState />}

            {kind === 'auth-required' && <AuthRequiredState />}

            {kind === 'rate-limited' && (
              <PlainNotice>
                Hit GitHub’s search rate limit. Try again in a minute.
              </PlainNotice>
            )}

            {kind === 'error' && (
              <PlainNotice>Couldn’t reach GitHub right now.</PlainNotice>
            )}

            {kind === 'ok' && items.length === 0 && (
              <PlainNotice>
                No matches for <em style={{ fontStyle: 'italic' }}>{q}</em>.
              </PlainNotice>
            )}

            {kind === 'ok' && items.length > 0 && (
              <>
                <p
                  className="mono uppercase tracking-[0.24em] text-[0.55rem] mb-3"
                  style={{ color: CREAM_DIM }}
                >
                  {total} {total === 1 ? 'match' : 'matches'}
                  {incomplete ? ' (partial — github capped the search)' : ''}
                </p>
                <ul className="space-y-3">
                  {items.map((it: any) => (
                    <li key={`${it.path}:${it.sha}`}>
                      <ResultCard paperId={id} item={it} query={q} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  paperId,
  item,
  query,
}: {
  paperId: string;
  item: any;
  query: string;
}) {
  // Show up to 3 fragments per file. text_matches comes back ordered by
  // GitHub's own relevance scoring; keep that order.
  const matches = Array.isArray(item.text_matches)
    ? item.text_matches.slice(0, 3)
    : [];
  return (
    <Link
      href={`/research/${paperId}/code/blob/${item.path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`}
      prefetch={false}
      className="block transition-transform"
      style={{
        background: PAPER_BG,
        color: INK,
        borderLeft: `2px solid ${INK}`,
        padding: '1rem 1.25rem',
      }}
    >
      <p
        className="font-mono text-[0.85rem] mb-2 break-all"
        style={{ color: INK }}
      >
        {item.path}
      </p>
      {matches.length === 0 ? (
        <p
          className="text-sm italic"
          style={{
            color: INK_FAINT,
            fontFamily: 'var(--font-fraunces, serif)',
          }}
        >
          (no preview available)
        </p>
      ) : (
        <div className="space-y-2">
          {matches.map((m: any, i: number) => (
            <pre
              key={i}
              className="overflow-x-auto"
              style={{
                background: 'rgba(13,13,13,0.04)',
                border: `1px solid rgba(13,13,13,0.08)`,
                padding: '0.65rem 0.85rem',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '0.78rem',
                lineHeight: 1.5,
                color: INK,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {highlightFragment(m.fragment || '', m.matches || [])}
            </pre>
          ))}
        </div>
      )}
    </Link>
  );
}

function highlightFragment(
  fragment: string,
  matches: Array<{ text: string; indices: [number, number] }>,
): React.ReactNode {
  if (!matches || matches.length === 0) return fragment;
  // Sort by start index ascending so we can walk the string once.
  const sorted = [...matches].sort((a, b) => a.indices[0] - b.indices[0]);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((m, i) => {
    const [start, end] = m.indices;
    if (start > cursor) out.push(fragment.slice(cursor, start));
    out.push(
      <mark
        key={i}
        style={{
          background: 'rgba(232,150,96,0.45)',
          color: '#0d0d0d',
          padding: 0,
        }}
      >
        {fragment.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < fragment.length) out.push(fragment.slice(cursor));
  return out;
}

function IdleState() {
  return (
    <div
      className="px-6 py-10 text-center"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR}`,
      }}
    >
      <p
        className="italic"
        style={{
          color: '#f4eee4',
          opacity: 0.75,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.05rem',
        }}
      >
        Type a phrase, identifier, or symbol to search this repo.
      </p>
      <p
        className="mt-2 mono uppercase tracking-[0.22em] text-[0.5rem]"
        style={{ color: 'rgba(244,238,228,0.4)' }}
      >
        github’s code search runs against an index that may lag a few hours behind a fresh push
      </p>
    </div>
  );
}

function AuthRequiredState() {
  return (
    <div
      className="px-6 py-8"
      style={{
        background: 'rgba(232,150,96,0.06)',
        border: `1px solid ${AMBER}55`,
      }}
    >
      <p
        className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
        style={{ color: AMBER }}
      >
        Code search needs a GitHub token
      </p>
      <p
        className="mb-2"
        style={{
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1rem',
          lineHeight: 1.5,
        }}
      >
        Unlike the other GitHub-backed surfaces, code search requires
        authentication on every request — there’s no anonymous access.
      </p>
      <p
        className="mb-3"
        style={{
          color: CREAM_DIM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '0.95rem',
          lineHeight: 1.5,
        }}
      >
        To enable it, set <code style={{ background: 'rgba(244,238,228,0.08)', padding: '0.1em 0.3em' }}>GITHUB_TOKEN</code>{' '}
        in the server env to a personal access token (no scopes needed for public repos).
      </p>
      <p
        className="mono uppercase tracking-[0.22em] text-[0.5rem]"
        style={{ color: CREAM_FAINT }}
      >
        readme, activity feed, file browser, branches, issues, PRs all keep working without it
      </p>
    </div>
  );
}

function PlainNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-6 py-8 text-center"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR}`,
      }}
    >
      <p
        className="italic"
        style={{
          color: CREAM_DIM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1rem',
        }}
      >
        {children}
      </p>
    </div>
  );
}
