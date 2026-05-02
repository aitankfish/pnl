/**
 * GET /api/research/[id]/repo/commit/[sha]
 *
 * Returns full commit detail for the linked repo: header (author, date,
 * message), parents, stats, and per-file patches. The page builds the
 * native diff view from this payload.
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

const CACHE_SECONDS = 60 * 60; // commits are immutable — long cache

interface GhCommit {
  sha: string;
  html_url: string;
  commit: {
    author: { name?: string; email?: string; date?: string } | null;
    committer: { name?: string; email?: string; date?: string } | null;
    message: string;
  };
  author: { login?: string; avatar_url?: string } | null;
  committer: { login?: string; avatar_url?: string } | null;
  parents: { sha: string }[];
  stats?: { additions: number; deletions: number; total: number };
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    blob_url?: string;
    raw_url?: string;
    patch?: string;
    previous_filename?: string;
  }>;
}

const SHA_RE = /^[0-9a-f]{7,40}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sha: string }> },
) {
  try {
    const { id, sha } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 },
      );
    }
    if (!SHA_RE.test(sha)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sha' },
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

    const result = await ghCachedFetch<GhCommit>(
      `/repos/${parsed.owner}/${parsed.repo}/commits/${sha}`,
      {
        cacheKey: `commit:${parsed.owner}/${parsed.repo}:${sha}`,
        ttlSeconds: CACHE_SECONDS,
      },
    );

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const c = result.data;
    const message = c.commit.message || '';
    const [subject, ...bodyParts] = message.split('\n');
    const body = bodyParts.join('\n').trim();

    return NextResponse.json({
      success: true,
      data: {
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        htmlUrl: c.html_url,
        subject,
        body: body || null,
        authorName:
          c.author?.login ||
          c.commit.author?.name ||
          'unknown',
        authorAvatarUrl: c.author?.avatar_url || null,
        authorDate: c.commit.author?.date || c.commit.committer?.date || null,
        parents: c.parents.map((p) => ({
          sha: p.sha,
          shortSha: p.sha.slice(0, 7),
        })),
        stats: c.stats || { additions: 0, deletions: 0, total: 0 },
        files: (c.files || []).map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          blobUrl: f.blob_url || null,
          rawUrl: f.raw_url || null,
          patch: f.patch || null,
          previousFilename: f.previous_filename || null,
        })),
      },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo/commit] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load commit' },
      { status: 500 },
    );
  }
}
