/**
 * POST /api/research/[id]/react
 *
 * Sentiment-only tick/X. Body: { reaction: 'like' | 'dislike' | null }.
 * One reaction per wallet per paper. Sending null clears the existing reaction.
 * Returns updated counts and the caller's current reaction.
 */

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper, PaperReaction } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

type Reaction = 'like' | 'dislike' | null;

export const POST = withAuth(async (request, authUser, { params }: any) => {
  try {
    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 },
      );
    }

    const rateLimited = checkRateLimit(
      `research:react:${authUser.walletAddress}`,
      30,
      60_000,
    );
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => ({}));
    const reaction: Reaction = body?.reaction ?? null;
    if (reaction !== 'like' && reaction !== 'dislike' && reaction !== null) {
      return NextResponse.json(
        { success: false, error: 'reaction must be "like", "dislike", or null' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const paper = await ResearchPaper.findById(id);
    if (!paper || paper.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Paper not found' },
        { status: 404 },
      );
    }

    const existing = await PaperReaction.findOne({
      paperId: paper._id,
      walletAddress: authUser.walletAddress,
    });

    let likeDelta = 0;
    let dislikeDelta = 0;

    if (existing) {
      if (existing.reaction === reaction) {
        // No-op; same reaction already recorded.
      } else if (reaction === null) {
        if (existing.reaction === 'like') likeDelta = -1;
        else dislikeDelta = -1;
        await existing.deleteOne();
      } else {
        // Switching sides.
        if (existing.reaction === 'like') likeDelta = -1;
        else dislikeDelta = -1;
        if (reaction === 'like') likeDelta += 1;
        else dislikeDelta += 1;
        existing.reaction = reaction;
        await existing.save();
      }
    } else if (reaction !== null) {
      if (reaction === 'like') likeDelta = 1;
      else dislikeDelta = 1;
      await PaperReaction.create({
        paperId: paper._id,
        walletAddress: authUser.walletAddress,
        reaction,
      });
    }

    if (likeDelta !== 0 || dislikeDelta !== 0) {
      await ResearchPaper.updateOne(
        { _id: paper._id },
        { $inc: { likeCount: likeDelta, dislikeCount: dislikeDelta } },
      );
    }

    const fresh = await ResearchPaper.findById(paper._id).lean<any>();

    return NextResponse.json({
      success: true,
      data: {
        reaction,
        likeCount: fresh?.likeCount || 0,
        dislikeCount: fresh?.dislikeCount || 0,
      },
    });
  } catch (error) {
    logger.error('[research/react] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to record reaction' },
      { status: 500 },
    );
  }
});

export const GET = withAuth(async (_request, authUser, { params }: any) => {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 },
      );
    }
    await connectToDatabase();
    const existing = await PaperReaction.findOne({
      paperId: id,
      walletAddress: authUser.walletAddress,
    }).lean<any>();
    return NextResponse.json({
      success: true,
      data: { reaction: existing?.reaction || null },
    });
  } catch (error) {
    logger.error('[research/react GET] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to read reaction' },
      { status: 500 },
    );
  }
});
