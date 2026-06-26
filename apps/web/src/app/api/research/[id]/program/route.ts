/**
 * POST /api/research/[id]/program
 *
 * Author-only: attach an existing paper to one of the author's programs (and
 * optionally set the paper it builds on), or detach it. Lets papers that were
 * published before programs existed join a program retroactively.
 *
 * Body: { programId?: string|null, parentPaperId?: string|null }
 *   - programId null/empty  → detach from any program
 *   - parentPaperId null/empty → clear lineage
 */

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper, ResearchProgram } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const POST = withAuth(async (request, authUser, { params }: any) => {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return badRequest('Invalid paper id');

    const body = await request.json().catch(() => ({}));
    const programIdRaw = body?.programId == null ? '' : String(body.programId).trim();
    const parentPaperIdRaw = body?.parentPaperId == null ? '' : String(body.parentPaperId).trim();

    await connectToDatabase();

    const paper = await ResearchPaper.findById(id);
    if (!paper || paper.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }
    if (paper.authorWallet !== authUser.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Only the author can change a paper’s program' },
        { status: 403 },
      );
    }

    // programId: '' clears; a value must be a program owned by this author.
    if (programIdRaw === '') {
      paper.programId = undefined;
    } else {
      if (!Types.ObjectId.isValid(programIdRaw)) return badRequest('Invalid programId');
      const program = await ResearchProgram.findById(programIdRaw).lean<any>();
      if (!program || program.status !== 'active') return badRequest('Program not found');
      if (program.ownerWallet !== authUser.walletAddress) {
        return badRequest('You can only add papers to a program you own');
      }
      paper.programId = programIdRaw;
    }

    // parentPaperId: '' clears; a value must be another active paper (not self).
    if (parentPaperIdRaw === '') {
      paper.parentPaperId = undefined;
    } else {
      if (!Types.ObjectId.isValid(parentPaperIdRaw)) return badRequest('Invalid parentPaperId');
      if (parentPaperIdRaw === id) return badRequest('A paper cannot build on itself');
      const parent = await ResearchPaper.findById(parentPaperIdRaw).select('_id status').lean<any>();
      if (!parent || parent.status !== 'active') return badRequest('Parent paper not found');
      paper.parentPaperId = parentPaperIdRaw;
    }

    paper.updatedAt = new Date();
    await paper.save();

    logger.info('[research/program] paper grouping updated', {
      paperId: id,
      programId: paper.programId || null,
    });

    return NextResponse.json({
      success: true,
      data: { paperId: id, programId: paper.programId || null, parentPaperId: paper.parentPaperId || null },
    });
  } catch (error) {
    logger.error('[research/program] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to update program' },
      { status: 500 },
    );
  }
});

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}
