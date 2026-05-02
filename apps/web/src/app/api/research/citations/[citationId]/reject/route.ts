/**
 * POST /api/research/citations/[citationId]/reject
 *
 * Auth-walled. Cited author rejects a pending citation. Requires:
 *   - the row's `paperAuthorWallet` matches the caller's wallet
 *   - the row's status is `pending`
 *
 * Rejected rows persist (status='rejected') so the founder can't simply
 * re-submit the same citation; they'd hit the unique (paperId,projectId)
 * index. If we ever want to allow re-submission after rejection, swap
 * to a hard-delete here.
 */

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PaperCitation } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const POST = withAuth(async (_request, authUser, { params }: any) => {
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
    if (citation.paperAuthorWallet !== authUser.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Only the cited author can reject' },
        { status: 403 },
      );
    }

    if (citation.status === 'rejected') {
      return NextResponse.json({ success: true, data: { id: String(citation._id), status: 'rejected' } });
    }
    if (citation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Citation is ${citation.status} and cannot be rejected` },
        { status: 409 },
      );
    }

    citation.status = 'rejected';
    citation.rejectedAt = new Date();
    await citation.save();

    logger.info('[research/citations/reject]', { id: String(citation._id) });

    return NextResponse.json({
      success: true,
      data: { id: String(citation._id), status: 'rejected' },
    });
  } catch (error) {
    logger.error('[research/citations/reject] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to reject' },
      { status: 500 },
    );
  }
});
