/**
 * POST /api/admin/research/[id]/hide
 *
 * Platform-admin moderation: hide or unhide a research paper. Hidden papers
 * drop out of the shelf (`/api/research/list` filters status:'active') and the
 * detail page (404s), but the document is preserved (reversible). Used to clear
 * spam/dummy papers — including ones posted by other wallets, which the normal
 * author-only routes can't touch.
 *
 * Body: { hidden?: boolean }  — defaults to true (hide).
 */

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { withAdmin } from '@/lib/auth/require-wallet';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const POST = withAdmin(async (request, adminUser, { params }: any) => {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid paper id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const hidden = body?.hidden === undefined ? true : !!body.hidden;

    await connectToDatabase();

    const paper = await ResearchPaper.findById(id);
    if (!paper) {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }

    paper.status = hidden ? 'hidden' : 'active';
    paper.updatedAt = new Date();
    await paper.save();

    logger.info('[admin/research/hide] moderation', {
      paperId: id,
      hidden,
      admin: adminUser.walletAddress,
    });

    return NextResponse.json({ success: true, data: { paperId: id, status: paper.status } });
  } catch (error) {
    logger.error('[admin/research/hide] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to update paper status' },
      { status: 500 },
    );
  }
});
