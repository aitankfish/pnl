/**
 * /research/[id]/code
 *
 * Repo overview — header (name, language, stars, default branch, GitHub
 * link), interactive file tree (lazy-loaded), and the recent commit
 * timeline. Server-fetches the metadata + root tree so the first paint
 * has real content; the FileTree expands deeper paths client-side.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Github,
  Star,
  GitFork,
  CircleDot,
} from 'lucide-react';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl } from '@/lib/github';
import { safeExternalUrl } from '@/lib/safe-url';
import { FileTree } from '@/components/research/FileTree';
import { PaperActivityFeed } from '@/components/research/PaperActivityFeed';
import { CodeSubnav } from '@/components/research/CodeSubnav';
import { BranchPicker } from '@/components/research/BranchPicker';
import { CodeSearchInput } from '@/components/research/CodeSearchInput';

export const dynamic = 'force-dynamic';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return { title: 'Code · PNL' };
  try {
    await connectToDatabase();
    const paper = await ResearchPaper.findById(id).lean<any>();
    if (!paper || paper.status !== 'active') return { title: 'Code · PNL' };
    return {
      title: `Code — ${paper.title} · PNL`,
      description: paper.summary || `Repository linked to ${paper.title}.`,
    };
  } catch {
    return { title: 'Code · PNL' };
  }
}

export default async function CodeOverviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const requestedRef = (sp.ref || '').trim();
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const paper = await ResearchPaper.findById(id).lean<any>();
  if (!paper || paper.status !== 'active') notFound();
  if (!paper.githubUrl) notFound();

  const parsed = parseRepoFromUrl(paper.githubUrl);
  if (!parsed) notFound();

  // Server-fetch repo metadata first so we know the default branch — the
  // tree fetch then targets either ?ref=branch (if provided) or default.
  const repoResult = await ghCachedFetch<any>(
    `/repos/${parsed.owner}/${parsed.repo}`,
    {
      cacheKey: `repo:${parsed.owner}/${parsed.repo}`,
      ttlSeconds: 5 * 60,
    },
  );
  const repo = repoResult.kind === 'ok' ? repoResult.data : null;
  const defaultBranch = repo?.default_branch || 'main';
  const activeRef = requestedRef || defaultBranch;
  const refQuery = requestedRef
    ? `?ref=${encodeURIComponent(requestedRef)}`
    : '';

  const treeResult = await ghCachedFetch<any[]>(
    `/repos/${parsed.owner}/${parsed.repo}/contents/${refQuery}`,
    {
      cacheKey: `tree:${parsed.owner}/${parsed.repo}:${activeRef}:/`,
      ttlSeconds: 5 * 60,
    },
  );

  const treeRaw = treeResult.kind === 'ok' && Array.isArray(treeResult.data)
    ? treeResult.data
    : [];
  const entries = treeRaw
    .map((e: any) => ({
      name: e.name,
      path: e.path,
      type: e.type,
      sha: e.sha,
      size: e.size || 0,
    }))
    .sort((a: any, b: any) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (b.type === 'dir' && a.type !== 'dir') return 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto pt-8 sm:pt-12">
          {/* Back link to paper */}
          <Link
            href={`/research/${id}`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to the paper
          </Link>

          {/* Header */}
          <header className="mb-10">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
              style={{ color: AMBER }}
            >
              The code · github.com/{parsed.owner}/{parsed.repo}
            </p>
            <h1
              className="leading-[1.05] mb-4"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
                fontFeatureSettings: '"ss01"',
                letterSpacing: '-0.01em',
              }}
            >
              {repo?.name || parsed.repo}
            </h1>
            {repo?.description && (
              <p
                className="mb-5 max-w-prose"
                style={{
                  color: CREAM_DIM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '1.1rem',
                  lineHeight: 1.5,
                }}
              >
                {repo.description}
              </p>
            )}

            {/* Repo facts row */}
            {repo && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {repo.language && (
                  <span
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1.5"
                    style={{ color: CREAM_DIM }}
                  >
                    <span
                      className="w-2 h-2 inline-block rounded-full"
                      style={{ background: FOREST }}
                    />
                    {repo.language}
                  </span>
                )}
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1.5"
                  style={{ color: CREAM_DIM }}
                >
                  <Star className="w-3 h-3" />
                  {repo.stargazers_count} stars
                </span>
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1.5"
                  style={{ color: CREAM_DIM }}
                >
                  <GitFork className="w-3 h-3" />
                  {repo.forks_count} forks
                </span>
                {repo.open_issues_count > 0 && (
                  <span
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1.5"
                    style={{ color: CREAM_DIM }}
                  >
                    <CircleDot className="w-3 h-3" />
                    {repo.open_issues_count} open issues
                  </span>
                )}
                <BranchPicker
                  paperId={id}
                  defaultBranch={defaultBranch}
                  current={activeRef}
                />
                <span className="ml-auto" />
                {safeExternalUrl(repo.html_url || paper.githubUrl) && (
                <a
                  href={safeExternalUrl(repo.html_url || paper.githubUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono uppercase tracking-[0.22em] text-[0.6rem] inline-flex items-center gap-1.5 transition-colors"
                  style={{ color: AMBER }}
                >
                  <Github className="w-3.5 h-3.5" />
                  view on github
                  <ExternalLink className="w-3 h-3" />
                </a>
                )}
              </div>
            )}
          </header>

          <CodeSubnav paperId={id} />

          {/* Compact search input above the file tree — submits to /code/search */}
          <div className="mb-5 max-w-md">
            <CodeSearchInput paperId={id} compact />
          </div>

          {/* File tree */}
          <section>
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
              style={{ color: AMBER }}
            >
              Files
            </p>
            {entries.length === 0 ? (
              <div
                className="px-5 py-8 text-center"
                style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR}` }}
              >
                <p
                  className="italic"
                  style={{
                    color: CREAM_DIM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '1rem',
                  }}
                >
                  Nothing to read here yet.
                </p>
                <p
                  className="mt-2 mono uppercase tracking-[0.22em] text-[0.55rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  {treeResult.kind === 'rate-limited'
                    ? 'github rate limit · try again soon'
                    : treeResult.kind === 'not-found'
                    ? 'repo gone or private'
                    : 'no files in the default branch'}
                </p>
              </div>
            ) : (
              <FileTree
                paperId={id}
                initialEntries={entries}
                defaultBranch={defaultBranch}
                ref={requestedRef || undefined}
              />
            )}
          </section>

          {/* Activity feed */}
          <PaperActivityFeed paperId={id} />
        </div>
      </div>
    </div>
  );
}
