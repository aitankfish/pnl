/**
 * GET /api/research/[id]/activity
 *
 * Returns recent commits from the paper's linked GitHub repo. Cached in
 * Redis for 10 minutes per repo to stay well under the GitHub unauth
 * limit (60 req/hr). Set GITHUB_TOKEN to raise the ceiling to 5000/hr.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'PNL-Research-Reader/1.0';
const CACHE_SECONDS = 10 * 60;
const COMMITS_LIMIT = 20;

interface CommitTile {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorAvatarUrl: string | null;
  url: string;
  date: string;
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

    const cacheKey = prefixKey(`research:activity:${parsed.owner}/${parsed.repo}`);

    // Cache hit?
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }
    } catch (err) {
      logger.warn('[research/activity] redis read failed; continuing', {
        err: err instanceof Error ? err.message : String(err),
      } as any);
    }

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const url = `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}/commits?per_page=${COMMITS_LIMIT}`;
    const ghRes = await fetch(url, { headers });

    if (ghRes.status === 404) {
      return NextResponse.json(
        { success: false, error: 'Repo gone or private', repo: `${parsed.owner}/${parsed.repo}` },
        { status: 404 },
      );
    }
    if (ghRes.status === 403) {
      return NextResponse.json(
        { success: false, error: 'GitHub rate limit exceeded' },
        { status: 502 },
      );
    }
    if (!ghRes.ok) {
      logger.error('[research/activity] github commits fetch failed', {
        status: ghRes.status,
      } as any);
      return NextResponse.json(
        { success: false, error: 'GitHub returned an error' },
        { status: 502 },
      );
    }

    const raw = (await ghRes.json()) as any[];
    const commits: CommitTile[] = (Array.isArray(raw) ? raw : []).map((c) => {
      const message = String(c?.commit?.message || '').split('\n')[0].slice(0, 200);
      const sha = String(c?.sha || '');
      return {
        sha,
        shortSha: sha.slice(0, 7),
        message,
        authorName: c?.author?.login || c?.commit?.author?.name || 'unknown',
        authorAvatarUrl: c?.author?.avatar_url || null,
        url: c?.html_url || `https://github.com/${parsed.owner}/${parsed.repo}/commit/${sha}`,
        date: c?.commit?.author?.date || c?.commit?.committer?.date || new Date().toISOString(),
      };
    });

    const payload = {
      repo: `${parsed.owner}/${parsed.repo}`,
      repoUrl: paper.githubUrl,
      commits,
      fetchedAt: new Date().toISOString(),
    };

    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, CACHE_SECONDS, JSON.stringify(payload));
    } catch (err) {
      logger.warn('[research/activity] redis write failed; continuing', {
        err: err instanceof Error ? err.message : String(err),
      } as any);
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    logger.error('[research/activity] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load activity' },
      { status: 500 },
    );
  }
}

function parseRepoFromUrl(url: string): { owner: string; repo: string } | null {
  const cleaned = url.trim().replace(/^https?:\/\//i, '').replace(/^github\.com\//i, '');
  const parts = cleaned.split(/[/?#]/).filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return null;
  }
  return { owner, repo };
}
