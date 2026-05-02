/**
 * POST /api/research/create
 *
 * Phase 1: sentiment-only research paper submission. No on-chain transaction.
 * Accepts a PDF + author metadata, uploads the PDF to IPFS, persists a
 * ResearchPaper document. Returns the new paper's id.
 */

import { NextResponse } from 'next/server';
import { ipfsUtils } from '@/lib/ipfs';
import { createClientLogger } from '@/lib/logger';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';

const logger = createClientLogger();

const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_PDF_TYPES = ['application/pdf'];

export const POST = withAuth(async (request, authUser) => {
  try {
    const rateLimited = checkRateLimit(`research:create:${authUser.walletAddress}`, 3, 60_000);
    if (rateLimited) return rateLimited;

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Expected multipart/form-data' },
        { status: 400 },
      );
    }

    const formData = await request.formData();

    const title = (formData.get('title') as string | null)?.trim() || '';
    const authorName = (formData.get('authorName') as string | null)?.trim() || '';
    const authorXHandleRaw = (formData.get('authorXHandle') as string | null)?.trim() || '';
    const summary = (formData.get('summary') as string | null)?.trim() || '';
    const githubUrlRaw = (formData.get('githubUrl') as string | null)?.trim() || '';
    const paperFile = formData.get('paper') as File | null;

    if (!title) return badRequest('Title is required');
    if (title.length > 255) return badRequest('Title is too long');
    if (!authorName) return badRequest('Author name is required');
    if (authorName.length > 120) return badRequest('Author name is too long');

    // X handle is optional. Strip leading @, validate shape if present.
    let authorXHandle = authorXHandleRaw.replace(/^@+/, '');
    if (authorXHandle && !/^[A-Za-z0-9_]{1,15}$/.test(authorXHandle)) {
      return badRequest('Invalid X handle');
    }

    if (summary.length > 500) return badRequest('Summary is too long (max 500)');

    let githubUrl: string | undefined;
    if (githubUrlRaw) {
      const parsed = parseGithubRepoUrl(githubUrlRaw);
      if (!parsed) return badRequest('Invalid GitHub repo URL');
      githubUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
    }

    if (!paperFile || paperFile.size === 0) {
      return badRequest('A PDF is required');
    }
    if (paperFile.size > MAX_PDF_SIZE) {
      return badRequest(`PDF too large (max ${MAX_PDF_SIZE / 1024 / 1024}MB)`);
    }
    if (!ALLOWED_PDF_TYPES.includes(paperFile.type)) {
      return badRequest('Only PDF files are accepted');
    }

    logger.info('[research/create] uploading PDF to IPFS', {
      wallet: authUser.walletAddress,
      filename: paperFile.name,
      size: paperFile.size,
    });

    const paperUrl = await ipfsUtils.uploadDocument(paperFile);

    await connectToDatabase();

    const now = new Date();
    const doc = await ResearchPaper.create({
      authorWallet: authUser.walletAddress,
      title,
      authorName,
      authorXHandle: authorXHandle || undefined,
      paperUrl,
      summary: summary || undefined,
      githubUrl,
      // First version recorded for the archive — every subsequent edit
      // appends a new entry, never replaces.
      versions: [
        {
          version: 1,
          paperUrl,
          title,
          summary: summary || undefined,
          githubUrl,
          createdAt: now,
        },
      ],
      currentVersion: 1,
      likeCount: 0,
      dislikeCount: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    logger.info('[research/create] paper saved', { paperId: doc._id });

    return NextResponse.json({
      success: true,
      data: {
        paperId: doc._id,
        paperUrl,
      },
    });
  } catch (error) {
    logger.error('[research/create] failed', error as any);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to publish research paper',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

/**
 * Parse a github repo URL into { owner, repo }. Accepts:
 *   https://github.com/owner/repo[.git][/...][?...]
 *   http://github.com/owner/repo[...]
 *   github.com/owner/repo[...]
 * Returns null on anything that doesn't shape like an owner/repo path.
 */
function parseGithubRepoUrl(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/^https?:\/\//i, '').replace(/^github\.com\//i, '');
  // After cleanup, expect "owner/repo" or "owner/repo/<rest>".
  const parts = cleaned.split(/[/?#]/).filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  let repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return null;
  }
  if (owner.length > 100 || repo.length > 200) return null;
  return { owner, repo };
}
