/**
 * GET /api/research/[id]/repo/tree?path=&ref=
 *
 * Lists the contents of a directory in the linked repo. Default path is
 * the repo root; default ref is the default branch.
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

// GitHub's "contents" endpoint returns either a single object (for a
// file) or an array of objects (for a directory).
interface GhContent {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  name: string;
  path: string;
  sha: string;
  size: number;
  download_url: string | null;
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
    const requestedPath = (searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');
    const ref = (searchParams.get('ref') || '').trim();

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

    const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const apiPath = `/repos/${parsed.owner}/${parsed.repo}/contents/${
      requestedPath ? encodeURIComponent(requestedPath).replace(/%2F/g, '/') : ''
    }${refQuery}`;

    const result = await ghCachedFetch<GhContent | GhContent[]>(apiPath, {
      cacheKey: `tree:${parsed.owner}/${parsed.repo}:${ref || 'default'}:${requestedPath || '/'}`,
      ttlSeconds: CACHE_SECONDS,
    });

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    // The contents API returns an array for directories, an object for files.
    const raw = Array.isArray(result.data) ? result.data : [result.data];

    // Sort: directories first, then files alphabetically. Standard tree.
    const entries = raw
      .map((e) => ({
        name: e.name,
        path: e.path,
        type: e.type,
        sha: e.sha,
        size: e.size,
      }))
      .sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (b.type === 'dir' && a.type !== 'dir') return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      success: true,
      data: {
        path: requestedPath,
        ref: ref || null,
        entries,
        // If the request resolved to a single file, callers may want to
        // pivot to the file viewer immediately.
        isFile: !Array.isArray(result.data),
      },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo/tree] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load tree' },
      { status: 500 },
    );
  }
}
