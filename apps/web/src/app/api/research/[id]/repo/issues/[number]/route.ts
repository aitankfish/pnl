/**
 * GET /api/research/[id]/repo/issues/[number]
 *
 * Returns a single issue (or PR — same endpoint shape) with its
 * comments. Used by both /code/issues/[n] and /code/pulls/[n].
 *
 * The `pull_request` field on the issue indicates whether this is a
 * PR. PR-specific fields (head/base, mergeable, draft) are fetched
 * separately by the /pulls API; this endpoint stays focused on the
 * common issue+comments shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import {
  ghCachedFetch,
  parseRepoFromUrl,
  errorBodyFor,
} from '@/lib/github';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const CACHE_SECONDS = 2 * 60;

const NUM_RE = /^[0-9]+$/;

interface GhIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: 'open' | 'closed';
  user: { login: string; avatar_url: string } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  labels: Array<{ name: string; color: string } | string>;
  pull_request?: any;
}

interface GhComment {
  id: number;
  body: string | null;
  user: { login: string; avatar_url: string } | null;
  created_at: string;
  html_url: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; number: string }> },
) {
  try {
    const { id, number } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 },
      );
    }
    if (!NUM_RE.test(number)) {
      return NextResponse.json(
        { success: false, error: 'Invalid number' },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const paper = await ResearchPaper.findById(id).lean<any>();
    if (!paper || paper.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Paper not found' },
        { status: 404 },
      );
    }
    if (!paper.githubUrl) {
      return NextResponse.json(
        { success: false, error: 'No linked repository' },
        { status: 404 },
      );
    }

    const parsed = parseRepoFromUrl(paper.githubUrl);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'Stored github URL is malformed' },
        { status: 500 },
      );
    }

    const [issueResult, commentsResult] = await Promise.all([
      ghCachedFetch<GhIssue>(
        `/repos/${parsed.owner}/${parsed.repo}/issues/${number}`,
        {
          cacheKey: `issue:${parsed.owner}/${parsed.repo}:${number}`,
          ttlSeconds: CACHE_SECONDS,
        },
      ),
      ghCachedFetch<GhComment[]>(
        `/repos/${parsed.owner}/${parsed.repo}/issues/${number}/comments`,
        {
          cacheKey: `issue:${parsed.owner}/${parsed.repo}:${number}:comments`,
          ttlSeconds: CACHE_SECONDS,
        },
      ),
    ]);

    if (issueResult.kind !== 'ok') {
      const e = errorBodyFor(issueResult.kind, (issueResult as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const i = issueResult.data;
    const comments =
      commentsResult.kind === 'ok' ? commentsResult.data || [] : [];

    return NextResponse.json({
      success: true,
      data: {
        number: i.number,
        title: i.title,
        body: i.body || null,
        htmlUrl: i.html_url,
        state: i.state,
        author: i.user?.login || 'unknown',
        authorAvatarUrl: i.user?.avatar_url || null,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        closedAt: i.closed_at,
        commentCount: i.comments,
        labels: (i.labels || []).map((l) =>
          typeof l === 'string'
            ? { name: l, color: '888888' }
            : { name: l.name, color: l.color || '888888' },
        ),
        isPullRequest: !!i.pull_request,
        comments: comments.map((c) => ({
          id: c.id,
          body: c.body || null,
          author: c.user?.login || 'unknown',
          authorAvatarUrl: c.user?.avatar_url || null,
          createdAt: c.created_at,
          htmlUrl: c.html_url,
        })),
      },
      cached: issueResult.cached,
    });
  } catch (error) {
    logger.error('[research/repo/issues/[n]] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load issue' },
      { status: 500 },
    );
  }
}
