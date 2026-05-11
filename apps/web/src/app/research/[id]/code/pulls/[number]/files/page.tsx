/**
 * /research/[id]/code/pulls/[number]/files
 *
 * "Files changed" view for a PR — renders the same DiffViewer used on
 * commit pages, one file per section. GitHub's /pulls/[n]/files endpoint
 * gives the same patch shape as the commit-files endpoint, so the diff
 * UI is reused as-is.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Github,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
} from 'lucide-react';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl } from '@/lib/github';
import { CodeSubnav } from '@/components/research/CodeSubnav';
import { DiffViewer } from '@/components/research/DiffViewer';

export const dynamic = 'force-dynamic';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';
const PURPLE = '#8b5cf6';

const NUM_RE = /^[0-9]+$/;

interface PageProps {
  params: Promise<{ id: string; number: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { number } = await params;
  return { title: `PR #${number} files · code · PNL` };
}

export default async function PullFilesPage({ params }: PageProps) {
  const { id, number } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  if (!NUM_RE.test(number)) notFound();

  await connectToDatabase();
  const paper = await ResearchPaper.findById(id).lean<any>();
  if (!paper || paper.status !== 'active') notFound();
  if (!paper.githubUrl) notFound();

  const parsed = parseRepoFromUrl(paper.githubUrl);
  if (!parsed) notFound();

  const [pullRes, filesRes, commentsRes] = await Promise.all([
    ghCachedFetch<any>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${number}`,
      {
        cacheKey: `pull:${parsed.owner}/${parsed.repo}:${number}`,
        ttlSeconds: 2 * 60,
      },
    ),
    ghCachedFetch<any[]>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${number}/files?per_page=100`,
      {
        cacheKey: `pull-files:${parsed.owner}/${parsed.repo}:${number}`,
        ttlSeconds: 5 * 60,
      },
    ),
    ghCachedFetch<any[]>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${number}/comments?per_page=100`,
      {
        cacheKey: `pull-review-comments:${parsed.owner}/${parsed.repo}:${number}`,
        ttlSeconds: 2 * 60,
      },
    ),
  ]);

  if (pullRes.kind === 'not-found') notFound();
  const pull = pullRes.kind === 'ok' ? pullRes.data : null;
  const files = filesRes.kind === 'ok' ? filesRes.data || [] : [];
  const reviewComments = commentsRes.kind === 'ok' ? commentsRes.data || [] : [];

  // Group review comments by file path so each DiffViewer only gets
  // the slice it cares about.
  const commentsByPath: Record<string, any[]> = {};
  for (const c of reviewComments) {
    if (!c.path) continue;
    (commentsByPath[c.path] ||= []).push({
      id: c.id,
      path: c.path,
      line: c.line ?? null,
      originalLine: c.original_line ?? null,
      side: c.side ?? null,
      body: c.body ?? null,
      author: c.user?.login || 'unknown',
      authorAvatarUrl: c.user?.avatar_url || null,
      htmlUrl: c.html_url,
      createdAt: c.created_at,
      inReplyToId: c.in_reply_to_id || null,
    });
  }

  if (!pull) {
    return (
      <ErrorShell
        id={id}
        owner={parsed.owner}
        repo={parsed.repo}
        message="Couldn’t load this pull request."
      />
    );
  }

  const isMerged = !!pull.merged_at;
  const isOpen = pull.state === 'open';
  const StateIcon = isMerged
    ? GitMerge
    : isOpen
    ? GitPullRequest
    : GitPullRequestClosed;
  const stateColor = isMerged ? PURPLE : isOpen ? FOREST : EARTH;
  const stateLabel = isMerged ? 'merged' : isOpen ? 'open' : 'closed';

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto pt-8 sm:pt-12">
          <Link
            href={`/research/${id}/code/pulls/${number}`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to the conversation
          </Link>

          <CodeSubnav paperId={id} />

          <header className="mb-6">
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-2"
              style={{ color: CREAM_FAINT }}
            >
              #{pull.number} · files changed
            </p>
            <h1
              className="leading-[1.15] mb-3"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                letterSpacing: '-0.005em',
              }}
            >
              {pull.title}
            </h1>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
              <span
                className="mono uppercase tracking-[0.2em] text-[0.55rem] inline-flex items-center gap-1.5 px-2 py-1"
                style={{ color: '#fff', background: stateColor }}
              >
                <StateIcon className="w-3 h-3" />
                {stateLabel}
              </span>
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: FOREST }}
              >
                +{pull.additions}
              </span>
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: EARTH }}
              >
                −{pull.deletions}
              </span>
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: CREAM_FAINT }}
              >
                {pull.changed_files}{' '}
                {pull.changed_files === 1 ? 'file' : 'files'}
              </span>
              <span className="ml-auto" />
              <a
                href={`${pull.html_url}/files`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono uppercase tracking-[0.22em] text-[0.6rem] inline-flex items-center gap-1.5"
                style={{ color: AMBER }}
              >
                <Github className="w-3.5 h-3.5" />
                view on github
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </header>

          {files.length === 0 ? (
            <p
              className="italic text-center py-10"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
              }}
            >
              {filesRes.kind === 'rate-limited'
                ? 'GitHub rate limit reached — try again shortly.'
                : 'No file changes.'}
            </p>
          ) : (
            <>
              {files.length >= 100 && (
                <p
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-4 italic"
                  style={{
                    color: CREAM_FAINT,
                    fontFamily: 'var(--font-fraunces, serif)',
                  }}
                >
                  showing the first 100 files · open on github for the rest
                </p>
              )}
              {files.map((f: any) => (
                <DiffViewer
                  key={f.filename}
                  file={{
                    filename: f.filename,
                    status: f.status,
                    additions: f.additions,
                    deletions: f.deletions,
                    changes: f.changes,
                    blobUrl: f.blob_url || null,
                    rawUrl: f.raw_url || null,
                    patch: f.patch || null,
                    previousFilename: f.previous_filename || null,
                  }}
                  comments={commentsByPath[f.filename] || []}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorShell({
  id,
  owner,
  repo,
  message,
}: {
  id: string;
  owner: string;
  repo: string;
  message: string;
}) {
  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto pt-8 sm:pt-12">
          <Link
            href={`/research/${id}/code/pulls`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to pulls
          </Link>
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
            style={{ color: AMBER }}
          >
            github.com/{owner}/{repo}
          </p>
          <p
            className="italic"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '1.1rem',
            }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
