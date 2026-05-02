/**
 * GET /api/research/[id]/repo/search?q=<query>
 *
 * Code search inside the linked repo. Calls GitHub's /search/code
 * endpoint with the text-match Accept header so we get snippets back.
 *
 * Caveats inherited from the upstream API:
 *   - 30 req/min authenticated, 10/min unauthenticated
 *   - Indexing lag — recently-pushed code may not appear immediately
 *   - Won't index repos under 87MB or with no commits in the last year
 *
 * We absorb repeats inside a 60s window via Redis. Front-end only
 * issues this request on submit (never per-keystroke) to respect the
 * tight rate limit.
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

const CACHE_SECONDS = 60;

interface GhSearchCodeResult {
  total_count: number;
  incomplete_results: boolean;
  items: Array<{
    name: string;
    path: string;
    sha: string;
    html_url: string;
    score: number;
    text_matches?: Array<{
      object_url: string;
      object_type: string;
      property: string;
      fragment: string;
      matches: Array<{ text: string; indices: [number, number] }>;
    }>;
  }>;
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
    const q = (searchParams.get('q') || '').trim();
    if (!q) {
      return NextResponse.json({
        success: true,
        data: { items: [], total: 0, q: '' },
      });
    }
    if (q.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Query is too long' },
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

    // Build the GitHub search query string. The repo qualifier scopes
    // results to this paper's linked repo only.
    const ghQuery = encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo}`);
    const result = await ghCachedFetch<GhSearchCodeResult>(
      `/search/code?q=${ghQuery}&per_page=30`,
      {
        cacheKey: `code-search:${parsed.owner}/${parsed.repo}:${q.toLowerCase()}`,
        ttlSeconds: CACHE_SECONDS,
        // text-match preview is opt-in via this Accept header.
        accept: 'application/vnd.github.text-match+json',
      },
    );

    if (result.kind !== 'ok') {
      // Code search is one of the few endpoints that returns 401 for
      // unauthenticated requests rather than just rate-limiting them.
      // Surface that as a config issue so deployers know to set
      // GITHUB_TOKEN — much friendlier than a generic 502.
      if (result.kind === 'error' && (result as any).status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: 'auth-required',
            message:
              'Code search requires a GitHub token. Ask the deployer to set GITHUB_TOKEN in the server env.',
          },
          { status: 503 },
        );
      }
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const items = (result.data.items || []).map((it) => ({
      name: it.name,
      path: it.path,
      sha: it.sha,
      htmlUrl: it.html_url,
      score: it.score,
      // Each text_match has a `fragment` (the snippet) and `matches`
      // (offsets within the fragment). The DiffViewer-style highlighter
      // would be overkill here; we just show the fragment with
      // bold-marked offsets.
      matches: (it.text_matches || []).map((tm) => ({
        fragment: tm.fragment,
        matches: tm.matches,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: result.data.total_count,
        incomplete: !!result.data.incomplete_results,
        q,
      },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo/search] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to search code' },
      { status: 500 },
    );
  }
}
