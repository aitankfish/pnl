/**
 * /research/[id]/code/issues/[number]
 *
 * Single issue read view: title, state, author, body, threaded comments.
 * Markdown is rendered as preserved-whitespace serif text — readable but
 * unstyled. Promoting to fully-rendered markdown is a future polish pass.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CircleDot,
  CheckCircle2,
  ExternalLink,
  Github,
  MessageSquare,
} from 'lucide-react';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl } from '@/lib/github';
import { CodeSubnav } from '@/components/research/CodeSubnav';
import { MarkdownBody } from '@/components/research/MarkdownBody';

export const dynamic = 'force-dynamic';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

const NUM_RE = /^[0-9]+$/;

interface PageProps {
  params: Promise<{ id: string; number: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { number } = await params;
  return { title: `Issue #${number} · code · PNL` };
}

export default async function IssueDetailPage({ params }: PageProps) {
  const { id, number } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  if (!NUM_RE.test(number)) notFound();

  await connectToDatabase();
  const paper = await ResearchPaper.findById(id).lean<any>();
  if (!paper || paper.status !== 'active') notFound();
  if (!paper.githubUrl) notFound();

  const parsed = parseRepoFromUrl(paper.githubUrl);
  if (!parsed) notFound();

  const [issueRes, commentsRes] = await Promise.all([
    ghCachedFetch<any>(
      `/repos/${parsed.owner}/${parsed.repo}/issues/${number}`,
      {
        cacheKey: `issue:${parsed.owner}/${parsed.repo}:${number}`,
        ttlSeconds: 2 * 60,
      },
    ),
    ghCachedFetch<any[]>(
      `/repos/${parsed.owner}/${parsed.repo}/issues/${number}/comments`,
      {
        cacheKey: `issue:${parsed.owner}/${parsed.repo}:${number}:comments`,
        ttlSeconds: 2 * 60,
      },
    ),
  ]);

  if (issueRes.kind === 'not-found') notFound();
  const issue = issueRes.kind === 'ok' ? issueRes.data : null;
  const comments = commentsRes.kind === 'ok' ? commentsRes.data || [] : [];

  if (!issue) {
    return (
      <ErrorShell id={id} owner={parsed.owner} repo={parsed.repo} />
    );
  }

  const isOpen = issue.state === 'open';

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-4xl mx-auto pt-8 sm:pt-12">
          <Link
            href={`/research/${id}/code/issues`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to issues
          </Link>

          <CodeSubnav paperId={id} />

          <header className="mb-6">
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-2"
              style={{ color: CREAM_FAINT }}
            >
              #{issue.number}
            </p>
            <h1
              className="leading-[1.15] mb-3"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
                letterSpacing: '-0.005em',
              }}
            >
              {issue.title}
            </h1>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
              <span
                className="mono uppercase tracking-[0.2em] text-[0.55rem] inline-flex items-center gap-1.5 px-2 py-1"
                style={{
                  color: '#fff',
                  background: isOpen ? FOREST : EARTH,
                }}
              >
                {isOpen ? (
                  <CircleDot className="w-3 h-3" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                {issue.state}
              </span>
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: CREAM_DIM }}
              >
                {issue.user?.login || 'unknown'} opened{' '}
                {timeAgo(issue.created_at)}
              </span>
              <span className="ml-auto" />
              <a
                href={issue.html_url}
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

          {/* Body */}
          <CommentBlock
            author={issue.user?.login || 'unknown'}
            createdAt={issue.created_at}
            body={issue.body}
            isOriginal
          />

          {comments.length > 0 && (
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem] mt-8 mb-3 inline-flex items-center gap-1.5"
              style={{ color: AMBER }}
            >
              <MessageSquare className="w-3 h-3" />
              {comments.length}{' '}
              {comments.length === 1 ? 'comment' : 'comments'}
            </p>
          )}

          <ul className="space-y-4">
            {comments.map((c: any) => (
              <li key={c.id}>
                <CommentBlock
                  author={c.user?.login || 'unknown'}
                  createdAt={c.created_at}
                  body={c.body}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CommentBlock({
  author,
  createdAt,
  body,
  isOriginal = false,
}: {
  author: string;
  createdAt: string;
  body: string | null;
  isOriginal?: boolean;
}) {
  return (
    <div
      style={{
        background: isOriginal
          ? 'rgba(232,150,96,0.05)'
          : 'rgba(244,238,228,0.025)',
        border: `1px solid ${isOriginal ? AMBER + '44' : HAIR_STRONG}`,
      }}
    >
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${HAIR_STRONG}` }}
      >
        <p
          className="mono uppercase tracking-[0.22em] text-[0.55rem]"
          style={{ color: CREAM_DIM }}
        >
          <span style={{ color: CREAM }}>{author}</span>
          <span style={{ color: CREAM_FAINT }}>
            {' '}
            · {timeAgo(createdAt)}
          </span>
        </p>
      </div>
      <div className="px-5 py-4">
        {body ? (
          <MarkdownBody source={body} />
        ) : (
          <p
            className="italic"
            style={{
              color: CREAM_FAINT,
              fontFamily: 'var(--font-fraunces, serif)',
            }}
          >
            (no body)
          </p>
        )}
      </div>
    </div>
  );
}

function ErrorShell({
  id,
  owner,
  repo,
}: {
  id: string;
  owner: string;
  repo: string;
}) {
  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto pt-8 sm:pt-12">
          <Link
            href={`/research/${id}/code/issues`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to issues
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
            Couldn’t load this issue.
          </p>
        </div>
      </div>
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
