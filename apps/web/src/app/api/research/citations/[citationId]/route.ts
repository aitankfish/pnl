/**
 * DELETE /api/research/citations/[citationId]
 *
 * Auth-walled. The project founder (citation.addedBy) can withdraw a
 * citation while it's still `pending`. The row is hard-deleted, freeing
 * up the (paperId, projectId) unique index in case the founder wants to
 * re-cite later. Auto and accepted rows can't be withdrawn this way —
 * they're already public.
 */

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PaperCitation } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const DELETE = withAuth(async (_request, authUser, { params }: any) => {
  try {
    const { citationId } = await params;
    if (!Types.ObjectId.isValid(citationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid citation id' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const citation = await PaperCitation.findById(citationId);
    if (!citation) {
      return NextResponse.json(
        { success: false, error: 'Citation not found' },
        { status: 404 },
      );
    }
    if (citation.addedBy !== authUser.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Only the project founder can withdraw' },
        { status: 403 },
      );
    }
    if (citation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot withdraw a ${citation.status} citation` },
        { status: 409 },
      );
    }

    await citation.deleteOne();

    logger.info('[research/citations/withdraw]', { id: citationId });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[research/citations/withdraw] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to withdraw' },
      { status: 500 },
    );
  }
});
