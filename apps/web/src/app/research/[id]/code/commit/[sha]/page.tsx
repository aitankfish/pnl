/**
 * /research/[id]/code/commit/[sha]
 *
 * Native commit detail view — author, date, message, parent shas, and
 * the per-file unified diff. Server-fetches the commit (1h Redis cache
 * since commits are immutable).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Github,
  GitCommit,
} from 'lucide-react';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl } from '@/lib/github';
import { DiffViewer } from '@/components/research/DiffViewer';

export const dynamic = 'force-dynamic';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

const SHA_RE = /^[0-9a-f]{7,40}$/i;

interface PageProps {
  params: Promise<{ id: string; sha: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { sha } = await params;
  return { title: `Commit ${sha?.slice(0, 7) ?? ''} · code · PNL` };
}

export default async function CommitPage({ params }: PageProps) {
  const { id, sha } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  if (!SHA_RE.test(sha)) notFound();

  await connectToDatabase();
  const paper = await ResearchPaper.findById(id).lean<any>();
  if (!paper || paper.status !== 'active') notFound();
  if (!paper.githubUrl) notFound();

  const parsed = parseRepoFromUrl(paper.githubUrl);
  if (!parsed) notFound();

  const result = await ghCachedFetch<any>(
    `/repos/${parsed.owner}/${parsed.repo}/commits/${sha}`,
    {
      cacheKey: `commit:${parsed.owner}/${parsed.repo}:${sha}`,
      ttlSeconds: 60 * 60,
    },
  );

  if (result.kind === 'not-found') notFound();

  const commit = result.kind === 'ok' ? result.data : null;
  if (!commit) {
    return (
      <ErrorShell
        id={id}
        owner={parsed.owner}
        repo={parsed.repo}
        message={
          result.kind === 'rate-limited'
            ? 'GitHub rate limit reached. Try again shortly.'
            : 'Couldn’t load this commit.'
        }
      />
    );
  }

  const message = commit.commit.message || '';
  const [subject, ...bodyParts] = message.split('\n');
  const body = bodyParts.join('\n').trim();
  const authorName =
    commit.author?.login || commit.commit.author?.name || 'unknown';
  const authorDate =
    commit.commit.author?.date || commit.commit.committer?.date || null;
  const stats = commit.stats || { additions: 0, deletions: 0, total: 0 };
  const files = commit.files || [];

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto pt-8 sm:pt-12">
          <Link
            href={`/research/${id}/code`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to the code overview
          </Link>

          {/* Commit header */}
          <header className="mb-8">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3 inline-flex items-center gap-2"
              style={{ color: AMBER }}
            >
              <GitCommit className="w-3.5 h-3.5" />
              Commit · {sha.slice(0, 7)}
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
              {subject}
            </h1>
            {body && (
              <pre
                className="mb-5 whitespace-pre-wrap"
                style={{
                  color: CREAM_DIM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '1rem',
                  lineHeight: 1.55,
                  borderLeft: `1px solid ${HAIR_STRONG}`,
                  paddingLeft: '1rem',
                }}
              >
                {body}
              </pre>
            )}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-4">
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: CREAM_DIM }}
              >
                {authorName}
              </span>
              {authorDate && (
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  {new Date(authorDate).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: FOREST }}
              >
                +{stats.additions}
              </span>
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: EARTH }}
              >
                −{stats.deletions}
              </span>
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: CREAM_FAINT }}
              >
                {files.length} {files.length === 1 ? 'file' : 'files'} changed
              </span>
              <span className="ml-auto" />
              <a
                href={commit.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mono uppercase tracking-[0.22em] text-[0.6rem] inline-flex items-center gap-1.5 transition-colors"
                style={{ color: AMBER }}
              >
                <Github className="w-3.5 h-3.5" />
                view on github
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </header>

          {/* Diff per file */}
          {files.length === 0 ? (
            <p
              className="italic text-center py-10"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
              }}
            >
              No file changes in this commit.
            </p>
          ) : (
            <div>
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
                />
              ))}
            </div>
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
            href={`/research/${id}/code`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to the code overview
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
