/**
 * GET /api/research/[id]/repo/pulls/[number]/comments
 *
 * Returns the PR's *review comments* — inline notes anchored to a
 * specific line/path in the diff (distinct from the conversation
 * comments fetched from /issues/[n]/comments).
 *
 * GitHub's response includes deprecated position fields plus the modern
 * `line` + `side`. We surface both so consumers can decide how to
 * anchor; the DiffViewer uses `line` + `side` against the parsed diff.
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

interface GhReviewComment {
  id: number;
  path: string;
  line: number | null;
  original_line: number | null;
  side: 'LEFT' | 'RIGHT' | null;
  start_line: number | null;
  start_side: 'LEFT' | 'RIGHT' | null;
  position: number | null;
  original_position: number | null;
  commit_id: string;
  body: string | null;
  user: { login: string; avatar_url: string } | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
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

    const result = await ghCachedFetch<GhReviewComment[]>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${number}/comments?per_page=100`,
      {
        cacheKey: `pull-review-comments:${parsed.owner}/${parsed.repo}:${number}`,
        ttlSeconds: CACHE_SECONDS,
      },
    );

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const comments = (result.data || []).map((c) => ({
      id: c.id,
      path: c.path,
      line: c.line,
      originalLine: c.original_line,
      side: c.side,
      startLine: c.start_line,
      startSide: c.start_side,
      body: c.body || null,
      author: c.user?.login || 'unknown',
      authorAvatarUrl: c.user?.avatar_url || null,
      htmlUrl: c.html_url,
      createdAt: c.created_at,
      inReplyToId: c.in_reply_to_id || null,
    }));

    // Pre-group by path so consumers (the DiffViewer) don't have to
    // walk the whole array per file.
    const byPath: Record<string, typeof comments> = {};
    for (const c of comments) {
      (byPath[c.path] ||= []).push(c);
    }

    return NextResponse.json({
      success: true,
      data: {
        comments,
        byPath,
        total: comments.length,
      },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo/pulls/[n]/comments] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load review comments' },
      { status: 500 },
    );
  }
}
