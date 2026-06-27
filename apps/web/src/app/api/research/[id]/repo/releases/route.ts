/**
 * GET /api/research/[id]/repo/releases
 *
 * Lists the linked repo's published releases (newest first). The piece of git
 * data milestone resolution needs that the other repo/* endpoints don't fetch.
 * Same `ghCachedFetch` + thesis-paper-githubUrl pattern as repo/pulls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl, errorBodyFor } from '@/lib/github';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const CACHE_SECONDS = 5 * 60;

interface GhRelease {
  name: string | null;
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  author: { login: string } | null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    await connectToDatabase();
    const paper = await ResearchPaper.findById(id).lean<any>();
    if (!paper || paper.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }
    if (!paper.githubUrl) {
      return NextResponse.json({ success: false, error: 'No linked repository' }, { status: 404 });
    }

    const parsed = parseRepoFromUrl(paper.githubUrl);
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'Stored github URL is malformed' }, { status: 500 });
    }

    const result = await ghCachedFetch<GhRelease[]>(
      `/repos/${parsed.owner}/${parsed.repo}/releases?per_page=30`,
      { cacheKey: `releases:${parsed.owner}/${parsed.repo}`, ttlSeconds: CACHE_SECONDS },
    );

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const releases = (result.data || [])
      .filter((r) => !r.draft)
      .map((r) => ({
        name: r.name || r.tag_name,
        tag: r.tag_name,
        htmlUrl: r.html_url,
        prerelease: !!r.prerelease,
        author: r.author?.login || null,
        publishedAt: r.published_at,
      }));

    return NextResponse.json({ success: true, data: { releases }, cached: result.cached });
  } catch (error) {
    logger.error('[research/repo/releases] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load releases' }, { status: 500 });
  }
}
