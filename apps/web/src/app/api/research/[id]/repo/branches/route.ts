/**
 * GET /api/research/[id]/repo/branches
 *
 * Returns the linked repo's branches — used to populate the branch
 * picker. Capped at 100 (the GitHub API per-page max) since trees with
 * more branches than that need a more interactive search picker than
 * v1 supports anyway; the picker has its own client-side filter on top.
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

interface GhBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export async function GET(
  _request: NextRequest,
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

    const result = await ghCachedFetch<GhBranch[]>(
      `/repos/${parsed.owner}/${parsed.repo}/branches?per_page=100`,
      {
        cacheKey: `branches:${parsed.owner}/${parsed.repo}`,
        ttlSeconds: CACHE_SECONDS,
      },
    );

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const branches = (result.data || []).map((b) => ({
      name: b.name,
      sha: b.commit?.sha || '',
      protected: !!b.protected,
    }));

    return NextResponse.json({
      success: true,
      data: { branches },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo/branches] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load branches' },
      { status: 500 },
    );
  }
}
