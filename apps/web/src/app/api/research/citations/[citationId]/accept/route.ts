/**
 * POST /api/research/citations/[citationId]/accept
 *
 * Auth-walled. Cited author accepts a pending citation. Requires:
 *   - the row's `paperAuthorWallet` matches the caller's wallet
 *   - the row's status is `pending`
 *
 * Idempotent: accepting an already-accepted row returns success.
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
        { success: false, error: 'Only the cited author can accept' },
        { status: 403 },
      );
    }

    if (citation.status === 'accepted') {
      return NextResponse.json({ success: true, data: { id: String(citation._id), status: 'accepted' } });
    }
    if (citation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Citation is ${citation.status} and cannot be accepted` },
        { status: 409 },
      );
    }

    citation.status = 'accepted';
    citation.acceptedAt = new Date();
    await citation.save();

    logger.info('[research/citations/accept]', { id: String(citation._id) });

    return NextResponse.json({
      success: true,
      data: { id: String(citation._id), status: 'accepted' },
    });
  } catch (error) {
    logger.error('[research/citations/accept] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to accept' },
      { status: 500 },
    );
  }
});
