/**
 * POST /api/research/[id]/version
 *
 * Author-only: append a new version to a research paper. Old versions
 * never get deleted — every revision is archival. Top-level fields on
 * the paper document are kept in sync with the new (current) version
 * for fast reads.
 *
 * Body (multipart/form-data):
 *   paper       — required PDF file (≤25MB)
 *   title       — optional title override (defaults to current)
 *   summary     — optional summary override
 *   githubUrl   — optional github URL override (or empty string to clear)
 *   changelog   — required short note (≤500 chars) describing the revision
 */

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ipfsUtils } from '@/lib/ipfs';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const MAX_PDF_SIZE = 25 * 1024 * 1024;
const ALLOWED_PDF_TYPES = ['application/pdf'];

export const POST = withAuth(async (request, authUser, { params }: any) => {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return badRequest('Invalid paper id');
    }

    // 3 versions per hour per (wallet, paper). Keeps fat-fingers from
    // flooding the archive while still allowing legitimate iteration.
    const rateLimited = await checkRateLimit(
      `research:version:${authUser.walletAddress}:${id}`,
      3,
      60 * 60 * 1000,
    );
    if (rateLimited) return rateLimited;

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return badRequest('Expected multipart/form-data');
    }

    const formData = await request.formData();
    const paperFile = formData.get('paper') as File | null;
    const titleRaw = (formData.get('title') as string | null)?.trim();
    const summaryRaw = (formData.get('summary') as string | null)?.trim();
    const githubUrlRaw = (formData.get('githubUrl') as string | null)?.trim();
    const changelog = (formData.get('changelog') as string | null)?.trim() || '';

    if (!changelog) return badRequest('A short changelog message is required');
    if (changelog.length > 500) return badRequest('Changelog is too long (max 500)');
    if (!paperFile || paperFile.size === 0) {
      return badRequest('A PDF is required');
    }
    if (paperFile.size > MAX_PDF_SIZE) {
      return badRequest(`PDF too large (max ${MAX_PDF_SIZE / 1024 / 1024}MB)`);
    }
    if (!ALLOWED_PDF_TYPES.includes(paperFile.type)) {
      return badRequest('Only PDF files are accepted');
    }

    let githubUrl: string | undefined;
    if (githubUrlRaw === '') {
      githubUrl = undefined; // explicit clear
    } else if (githubUrlRaw) {
      const parsed = parseGithubRepoUrl(githubUrlRaw);
      if (!parsed) return badRequest('Invalid GitHub repo URL');
      githubUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
    }

    await connectToDatabase();

    const paper = await ResearchPaper.findById(id);
    if (!paper || paper.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Paper not found' },
        { status: 404 },
      );
    }
    if (paper.authorWallet !== authUser.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Only the original author can publish a new version' },
        { status: 403 },
      );
    }

    logger.info('[research/version] uploading new version PDF', {
      paperId: id,
      filename: paperFile.name,
      size: paperFile.size,
    });

    const newPaperUrl = await ipfsUtils.uploadDocument(paperFile);

    const nextVersion = (paper.currentVersion || 1) + 1;
    const now = new Date();
    const title = titleRaw && titleRaw.length > 0 ? titleRaw : paper.title;
    const summary =
      summaryRaw === undefined
        ? paper.summary
        : summaryRaw.length > 0
        ? summaryRaw
        : undefined;
    if (title.length > 255) return badRequest('Title is too long');
    if (summary && summary.length > 500) return badRequest('Summary is too long (max 500)');

    // Backfill v1 from the legacy top-level fields if this paper predates
    // the versions array. Without this, the archive starts at v2 with no
    // record of the original publish.
    if (!paper.versions || paper.versions.length === 0) {
      paper.versions.push({
        version: 1,
        paperUrl: paper.paperUrl,
        title: paper.title,
        summary: paper.summary,
        githubUrl: paper.githubUrl,
        changelog: 'First published',
        createdAt: paper.createdAt || now,
      } as any);
    }

    paper.versions.push({
      version: nextVersion,
      paperUrl: newPaperUrl,
      title,
      summary,
      githubUrl,
      changelog,
      createdAt: now,
    } as any);
    paper.currentVersion = nextVersion;
    paper.title = title;
    paper.summary = summary;
    paper.githubUrl = githubUrl;
    paper.paperUrl = newPaperUrl;
    paper.updatedAt = now;
    await paper.save();

    logger.info('[research/version] new version saved', {
      paperId: id,
      version: nextVersion,
    });

    return NextResponse.json({
      success: true,
      data: {
        paperId: id,
        currentVersion: nextVersion,
        paperUrl: newPaperUrl,
      },
    });
  } catch (error) {
    logger.error('[research/version] failed', error as any);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to publish a new version',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

function parseGithubRepoUrl(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/^https?:\/\//i, '').replace(/^github\.com\//i, '');
  const parts = cleaned.split(/[/?#]/).filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return null;
  }
  if (owner.length > 100 || repo.length > 200) return null;
  return { owner, repo };
}
