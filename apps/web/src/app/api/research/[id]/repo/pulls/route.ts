/**
 * GET /api/research/[id]/repo/pulls?state=open|closed|all
 *
 * Lists pull requests for the linked repo. Uses GitHub's dedicated
 * /pulls endpoint so we get head/base branch info that the issues
 * endpoint doesn't expose.
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

const CACHE_SECONDS = 5 * 60;

interface GhPull {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  draft?: boolean;
  user: { login: string; avatar_url: string } | null;
  comments: number;
  review_comments?: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  labels: Array<{ name: string; color: string } | string>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const stateRaw = (searchParams.get('state') || 'open').toLowerCase();
    const state = ['open', 'closed', 'all'].includes(stateRaw)
      ? stateRaw
      : 'open';

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

    const result = await ghCachedFetch<GhPull[]>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls?state=${state}&per_page=30&sort=updated&direction=desc`,
      {
        cacheKey: `pulls:${parsed.owner}/${parsed.repo}:${state}`,
        ttlSeconds: CACHE_SECONDS,
      },
    );

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const pulls = (result.data || []).map((p) => ({
      number: p.number,
      title: p.title,
      htmlUrl: p.html_url,
      state: p.merged_at ? ('merged' as const) : p.state,
      isDraft: !!p.draft,
      author: p.user?.login || 'unknown',
      authorAvatarUrl: p.user?.avatar_url || null,
      commentCount: (p.comments || 0) + (p.review_comments || 0),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      closedAt: p.closed_at,
      mergedAt: p.merged_at,
      head: p.head?.ref || '',
      base: p.base?.ref || '',
      labels: (p.labels || []).map((l) =>
        typeof l === 'string'
          ? { name: l, color: '888888' }
          : { name: l.name, color: l.color || '888888' },
      ),
    }));

    return NextResponse.json({
      success: true,
      data: { pulls, state },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo/pulls] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load pulls' },
      { status: 500 },
    );
  }
}
