/**
 * GET /api/research/[id]/repo
 *
 * Returns the linked GitHub repo's overview metadata — name, description,
 * default branch, language, stars, license, topics. Used by the code
 * overview page header.
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

interface GhRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id?: string; name?: string } | null;
  topics?: string[];
  pushed_at: string;
  homepage: string | null;
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

    const result = await ghCachedFetch<GhRepo>(
      `/repos/${parsed.owner}/${parsed.repo}`,
      {
        cacheKey: `repo:${parsed.owner}/${parsed.repo}`,
        ttlSeconds: CACHE_SECONDS,
      },
    );

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const r = result.data;
    return NextResponse.json({
      success: true,
      data: {
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        htmlUrl: r.html_url,
        defaultBranch: r.default_branch,
        language: r.language,
        stargazersCount: r.stargazers_count,
        forksCount: r.forks_count,
        openIssuesCount: r.open_issues_count,
        license: r.license?.spdx_id || r.license?.name || null,
        topics: r.topics || [],
        pushedAt: r.pushed_at,
        homepage: r.homepage || null,
      },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load repo' },
      { status: 500 },
    );
  }
}
