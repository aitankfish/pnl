/**
 * /research/[id]/code/pulls
 *
 * Pull request list. Open / closed / all filter; merged PRs render with a
 * merge-coloured chip distinct from regular closed.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  MessageSquare,
} from 'lucide-react';
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
const PURPLE = '#8b5cf6'; // merged accent — distinguishes from closed-without-merge

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}

export const metadata = { title: 'Pull requests · code · PNL' };

export default async function PullsPage({ params, searchParams }: PageProps) {
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

  const [repoResult, pullsResult] = await Promise.all([
    ghCachedFetch<any>(`/repos/${parsed.owner}/${parsed.repo}`, {
      cacheKey: `repo:${parsed.owner}/${parsed.repo}`,
      ttlSeconds: 5 * 60,
    }),
    ghCachedFetch<any[]>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls?state=${state}&per_page=30&sort=updated&direction=desc`,
      {
        cacheKey: `pulls:${parsed.owner}/${parsed.repo}:${state}`,
        ttlSeconds: 5 * 60,
      },
    ),
  ]);

  const repo = repoResult.kind === 'ok' ? repoResult.data : null;
  const pulls = pullsResult.kind === 'ok' ? pullsResult.data || [] : [];

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
              Pull requests
            </h1>
          </header>

          <CodeSubnav paperId={id} />

          {/* State chips */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {(['open', 'closed', 'all'] as const).map((s) => {
              const active = s === state;
              return (
                <Link
                  key={s}
                  href={`/research/${id}/code/pulls${s === 'open' ? '' : `?state=${s}`}`}
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

          {pulls.length === 0 ? (
            <EmptyState state={state} />
          ) : (
            <ul
              style={{
                background: 'rgba(244,238,228,0.025)',
                border: `1px solid ${HAIR_STRONG}`,
              }}
            >
              {pulls.map((p: any) => {
                const isMerged = !!p.merged_at;
                const isOpen = p.state === 'open';
                const Icon = isMerged
                  ? GitMerge
                  : isOpen
                  ? GitPullRequest
                  : GitPullRequestClosed;
                const iconColor = isMerged ? PURPLE : isOpen ? FOREST : EARTH;
                return (
                  <li key={p.number} style={{ borderBottom: `1px solid ${HAIR}` }}>
                    <Link
                      href={`/research/${id}/code/pulls/${p.number}`}
                      className="block px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <Icon
                          className="w-4 h-4 mt-0.5 flex-shrink-0"
                          style={{ color: iconColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="line-clamp-2 mb-1"
                            style={{
                              color: CREAM,
                              fontFamily: 'var(--font-fraunces, serif)',
                              fontSize: '1rem',
                            }}
                          >
                            {p.title}
                            {p.draft && (
                              <span
                                className="ml-2 mono uppercase tracking-[0.18em] text-[0.5rem] px-1.5 py-0.5"
                                style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                              >
                                draft
                              </span>
                            )}
                          </p>
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                            <span
                              className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                              style={{ color: CREAM_FAINT }}
                            >
                              #{p.number} ·{' '}
                              {isMerged
                                ? 'merged'
                                : isOpen
                                ? 'opened'
                                : 'closed'}{' '}
                              {timeAgo(
                                isMerged
                                  ? p.merged_at
                                  : isOpen
                                  ? p.created_at
                                  : p.closed_at,
                              )}{' '}
                              by {p.user?.login || 'unknown'}
                            </span>
                            <span
                              className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                              style={{ color: CREAM_FAINT }}
                            >
                              {p.head?.ref} → {p.base?.ref}
                            </span>
                          </div>
                        </div>
                        {(p.comments || 0) + (p.review_comments || 0) > 0 && (
                          <span
                            className="mono text-[0.55rem] inline-flex items-center gap-1 flex-shrink-0"
                            style={{ color: CREAM_FAINT }}
                          >
                            <MessageSquare className="w-3 h-3" />
                            {(p.comments || 0) + (p.review_comments || 0)}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
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
          ? 'No open pull requests.'
          : state === 'closed'
          ? 'No closed pull requests yet.'
          : 'No pull requests at all.'}
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
