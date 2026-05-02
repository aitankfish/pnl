/**
 * GET /api/research/[id]/repo/file?path=&ref=
 *
 * Returns the contents of a single file in the repo, decoded and
 * size-checked. Binary files are returned as { binary: true,
 * downloadUrl } so the client can show a "download from GitHub"
 * affordance instead of trying to render bytes as text.
 *
 * The 1MB ceiling here mirrors GitHub's own contents API limit — files
 * larger than that cannot be retrieved this way.
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
const MAX_TEXT_BYTES = 1024 * 1024; // 1MB

interface GhContent {
  type: string;
  name: string;
  path: string;
  sha: string;
  size: number;
  encoding?: string;
  content?: string;
  download_url: string | null;
  html_url: string | null;
}

// Heuristic — extensions that we never try to decode as text. GitHub's
// own API will refuse files that fail UTF-8 anyway, but flagging up
// front lets us show a friendlier UI without a round-trip.
const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tiff',
  'pdf', 'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'mp3', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'wav', 'flac', 'ogg',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'so', 'dylib', 'dll', 'exe', 'wasm',
  'class', 'jar',
]);

function isLikelyBinary(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  return BINARY_EXTS.has(ext);
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
    const requestedPath = (searchParams.get('path') || '').replace(/^\/+/, '');
    const ref = (searchParams.get('ref') || '').trim();

    if (!requestedPath) {
      return NextResponse.json(
        { success: false, error: 'path is required' },
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

    const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const apiPath = `/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(
      requestedPath,
    ).replace(/%2F/g, '/')}${refQuery}`;

    const result = await ghCachedFetch<GhContent>(apiPath, {
      cacheKey: `file:${parsed.owner}/${parsed.repo}:${ref || 'default'}:${requestedPath}`,
      ttlSeconds: CACHE_SECONDS,
    });

    if (result.kind !== 'ok') {
      const e = errorBodyFor(result.kind, (result as any).status);
      return NextResponse.json(e.body, { status: e.status });
    }

    const r = result.data;
    if (r.type !== 'file') {
      return NextResponse.json(
        { success: false, error: 'Not a file' },
        { status: 400 },
      );
    }

    // Binary heuristic + GitHub's own size cap.
    if (isLikelyBinary(r.name) || r.size > MAX_TEXT_BYTES) {
      return NextResponse.json({
        success: true,
        data: {
          path: r.path,
          name: r.name,
          sha: r.sha,
          size: r.size,
          binary: true,
          content: null,
          downloadUrl: r.download_url,
          htmlUrl: r.html_url,
        },
        cached: result.cached,
      });
    }

    let content = '';
    if (r.encoding === 'base64' && r.content) {
      content = Buffer.from(r.content.replace(/\n/g, ''), 'base64').toString(
        'utf-8',
      );
    } else if (r.content) {
      content = r.content;
    }

    return NextResponse.json({
      success: true,
      data: {
        path: r.path,
        name: r.name,
        sha: r.sha,
        size: r.size,
        binary: false,
        content,
        downloadUrl: r.download_url,
        htmlUrl: r.html_url,
      },
      cached: result.cached,
    });
  } catch (error) {
    logger.error('[research/repo/file] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load file' },
      { status: 500 },
    );
  }
}
