/**
 * /api/research/programs
 *
 * POST  — create a research program (auth required). A program is a thin,
 *         off-chain grouping that papers attach to via `programId`.
 * GET    — list programs. `?owner=<wallet>` filters to one author's programs;
 *         otherwise returns recent active programs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ResearchProgram, ResearchPaper } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const POST = withAuth(async (request, authUser) => {
  try {
    const rateLimited = await checkRateLimit(
      `research:program:create:${authUser.walletAddress}`,
      5,
      60 * 60 * 1000,
    );
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const summary = String(body?.summary || '').trim();
    const slugRaw = String(body?.slug || '').trim();

    if (!title) return badRequest('A program title is required');
    if (title.length > 120) return badRequest('Title is too long (max 120)');
    if (summary.length > 500) return badRequest('Summary is too long (max 500)');

    await connectToDatabase();

    const base = slugify(slugRaw || title);
    if (!base) return badRequest('Could not derive a valid slug from the title');
    const slug = await uniqueSlug(base);

    const now = new Date();
    const program = await ResearchProgram.create({
      ownerWallet: authUser.walletAddress,
      slug,
      title,
      summary: summary || undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    logger.info('[research/programs] created', { slug, owner: authUser.walletAddress });

    return NextResponse.json({
      success: true,
      data: { id: String(program._id), slug: program.slug, title: program.title },
    });
  } catch (error) {
    logger.error('[research/programs] create failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to create program' },
      { status: 500 },
    );
  }
});

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const owner = request.nextUrl.searchParams.get('owner')?.trim();
    const query: Record<string, unknown> = { status: 'active' };
    if (owner) query.ownerWallet = owner;

    const programs = await ResearchProgram.find(query)
      .sort({ updatedAt: -1 })
      .limit(owner ? 100 : 50)
      .lean<any[]>();

    // Count papers per program in one grouped query (cheap, drives the list UI).
    const slugs = programs.map((p) => String(p._id));
    const counts = slugs.length
      ? await ResearchPaper.aggregate([
          { $match: { programId: { $in: slugs }, status: 'active' } },
          { $group: { _id: '$programId', n: { $sum: 1 } } },
        ])
      : [];
    const countById = new Map(counts.map((c: any) => [String(c._id), c.n]));

    return NextResponse.json({
      success: true,
      data: {
        programs: programs.map((p) => ({
          id: String(p._id),
          slug: p.slug,
          title: p.title,
          summary: p.summary || null,
          ownerWallet: p.ownerWallet,
          paperCount: countById.get(String(p._id)) || 0,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('[research/programs] list failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to list programs' },
      { status: 500 },
    );
  }
}

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

// Append -2, -3, … until the slug is free. Bounded so a pathological clash
// can't loop forever; falls back to a short random suffix.
async function uniqueSlug(base: string): Promise<string> {
  if (!(await ResearchProgram.exists({ slug: base }))) return base;
  for (let i = 2; i <= 50; i++) {
    const candidate = `${base}-${i}`.slice(0, 64);
    if (!(await ResearchProgram.exists({ slug: candidate }))) return candidate;
  }
  return `${base}-${Math.floor(performance.now()).toString(36)}`.slice(0, 64);
}
