/**
 * /research/[id]/code/issues
 *
 * Issues list. Filters out PRs (GitHub's /issues endpoint includes them).
 * Open/closed/all filter via query string. Each row links to the issue
 * detail page.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CircleDot, CheckCircle2, MessageSquare } from 'lucide-react';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl } from '@/lib/github';
import { CodeSubnav } from '@/components/research/CodeSubnav';

export const dynamic = 'force-dynamic';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}

export const metadata = { title: 'Issues · code · PNL' };

export default async function IssuesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const stateRaw = (sp.state || 'open').toLowerCase();
  const state: 'open' | 'closed' | 'all' = ['open', 'closed', 'all'].includes(
    stateRaw,
  )
    ? (stateRaw as any)
    : 'open';

  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const paper = await ResearchPaper.findById(id).lean<any>();
  if (!paper || paper.status !== 'active') notFound();
  if (!paper.githubUrl) notFound();

  const parsed = parseRepoFromUrl(paper.githubUrl);
  if (!parsed) notFound();

  const [repoResult, listResult] = await Promise.all([
    ghCachedFetch<any>(`/repos/${parsed.owner}/${parsed.repo}`, {
      cacheKey: `repo:${parsed.owner}/${parsed.repo}`,
      ttlSeconds: 5 * 60,
    }),
    ghCachedFetch<any[]>(
      `/repos/${parsed.owner}/${parsed.repo}/issues?state=${state}&per_page=30&sort=updated`,
      {
        cacheKey: `issues:${parsed.owner}/${parsed.repo}:${state}`,
        ttlSeconds: 5 * 60,
      },
    ),
  ]);

  const repo = repoResult.kind === 'ok' ? repoResult.data : null;
  const all = listResult.kind === 'ok' ? listResult.data || [] : [];
  const issues = all.filter((i: any) => !i.pull_request);

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto pt-8 sm:pt-12">
          <Link
            href={`/research/${id}`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to the paper
          </Link>

          <header className="mb-6">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-2"
              style={{ color: AMBER }}
            >
              github.com/{parsed.owner}/{parsed.repo}
            </p>
            <h1
              className="leading-[1.05] mb-2"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
                letterSpacing: '-0.005em',
              }}
            >
              Issues
            </h1>
          </header>

          {/* No counts on the subnav for now — GitHub's `open_issues_count`
              actually includes PRs, so any number we'd show would be
              misleading until we fetch each list separately. */}
          <CodeSubnav paperId={id} />

          {/* State chips */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {(['open', 'closed', 'all'] as const).map((s) => {
              const active = s === state;
              return (
                <Link
                  key={s}
                  href={`/research/${id}/code/issues${s === 'open' ? '' : `?state=${s}`}`}
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] px-3 py-1.5 transition-colors"
                  style={{
                    background: active ? AMBER : 'transparent',
                    color: active ? '#0a0814' : CREAM_DIM,
                    border: `1px solid ${active ? AMBER : HAIR_STRONG}`,
                  }}
                >
                  {s}
                </Link>
              );
            })}
          </div>

          {issues.length === 0 ? (
            <EmptyState state={state} />
          ) : (
            <ul
              style={{
                background: 'rgba(244,238,228,0.025)',
                border: `1px solid ${HAIR_STRONG}`,
              }}
            >
              {issues.map((i: any) => (
                <li
                  key={i.number}
                  style={{ borderBottom: `1px solid ${HAIR}` }}
                >
                  <IssueRow paperId={id} issue={i} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueRow({ paperId, issue }: { paperId: string; issue: any }) {
  const isOpen = issue.state === 'open';
  return (
    <Link
      href={`/research/${paperId}/code/issues/${issue.number}`}
      className="block px-4 py-3 transition-colors"
    >
      <div className="flex items-start gap-3">
        {isOpen ? (
          <CircleDot
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            style={{ color: FOREST }}
          />
        ) : (
          <CheckCircle2
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            style={{ color: EARTH }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="line-clamp-2 mb-1"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '1rem',
            }}
          >
            {issue.title}
          </p>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
            <span
              className="mono uppercase tracking-[0.22em] text-[0.5rem]"
              style={{ color: CREAM_FAINT }}
            >
              #{issue.number} · {isOpen ? 'opened' : 'closed'}{' '}
              {timeAgo(isOpen ? issue.created_at : issue.closed_at)} by{' '}
              {issue.user?.login || 'unknown'}
            </span>
            {issue.labels?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {issue.labels.slice(0, 4).map((l: any, idx: number) => (
                  <span
                    key={idx}
                    className="mono uppercase tracking-[0.18em] text-[0.5rem] px-1.5 py-0.5"
                    style={{
                      color: '#0a0814',
                      background: `#${typeof l === 'string' ? '888888' : l.color || '888888'}`,
                    }}
                  >
                    {typeof l === 'string' ? l : l.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {issue.comments > 0 && (
          <span
            className="mono text-[0.55rem] inline-flex items-center gap-1 flex-shrink-0"
            style={{ color: CREAM_FAINT }}
          >
            <MessageSquare className="w-3 h-3" />
            {issue.comments}
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ state }: { state: string }) {
  return (
    <div
      className="text-center py-16 px-6"
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
          fontSize: '1.1rem',
        }}
      >
        {state === 'open'
          ? 'Nothing open right now.'
          : state === 'closed'
          ? 'Nothing closed yet.'
          : 'No issues at all.'}
      </p>
    </div>
  );
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (!isFinite(d)) return '';
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
