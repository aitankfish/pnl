/**
 * GET /api/research/[id]/repo/issues?state=open|closed|all
 *
 * Lists issues on the linked repo. GitHub's `/issues` endpoint actually
 * returns issues *and* pull requests (PRs are technically issues
 * underneath); we filter PRs out so this view only shows true issues.
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
const PER_PAGE = 30;

interface GhIssue {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  user: { login: string; avatar_url: string } | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: Array<{ name: string; color: string } | string>;
  pull_request?: any; // present means it's a PR — we filter these out
  draft?: boolean;
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

    const result = await ghCachedFetch<GhIssue[]>(
      `/repos/${parsed.owner}/${parsed.repo}/issues?state=${state}&per_page=${PER_PAGE}&sort=updated`,
      {
        cacheKey: `issues:${parsed.owner}/${parsed.repo}:${state}`,
        ttlSeconds: CACHE_SECONDS,
      },
    );

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const issues = (result.data || [])
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        htmlUrl: i.html_url,
        state: i.state,
        author: i.user?.login || 'unknown',
        authorAvatarUrl: i.user?.avatar_url || null,
        commentCount: i.comments,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        closedAt: i.closed_at,
        labels: (i.labels || []).map((l) =>
          typeof l === 'string'
            ? { name: l, color: '888888' }
            : { name: l.name, color: l.color || '888888' },
        ),
      }));

    return NextResponse.json({
      success: true,
      data: { issues, state },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo/issues] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load issues' },
      { status: 500 },
    );
  }
}
