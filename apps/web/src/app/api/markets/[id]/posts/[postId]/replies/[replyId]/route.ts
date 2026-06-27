/**
 * DELETE /api/markets/[id]/posts/[postId]/replies/[replyId]
 *
 * Hide a reply (reversible). Allowed for: the reply author, the market's
 * founder (post owner), or a platform admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PostReply, PredictionMarket, Project } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { isPlatformAdmin } from '@/lib/admin';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const DELETE = withAuth(async (_request: NextRequest, authUser, { params }: any) => {
  try {
    const { id, replyId } = await params;
    if (!Types.ObjectId.isValid(replyId)) return bad('Invalid reply id');

    await connectToDatabase();
    const reply = await PostReply.findById(replyId);
    if (!reply) return bad('Reply not found', 404);

    // Resolve the market in the URL and confirm the reply actually belongs to
    // it — otherwise a founder of market A could moderate replies on market B
    // by hitting /api/markets/<A>/.../replies/<reply-from-B>.
    const market = await PredictionMarket.findOne(
      Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
    ).lean<any>();
    if (!market || reply.marketAddress !== market.marketAddress) {
      return bad('Reply not found', 404);
    }

    const wallet = authUser.walletAddress;
    const founderWallet =
      (market.projectId ? (await Project.findById(market.projectId).lean<any>())?.founderWallet : null) ||
      market.founderWallet;
    const allowed =
      reply.authorWallet === wallet ||
      isPlatformAdmin(wallet) ||
      (!!founderWallet && founderWallet === wallet);

    if (!allowed) return bad('Not allowed to remove this reply', 403);

    reply.status = 'hidden';
    await reply.save();
    logger.info('[post-reply] hidden', { replyId, by: wallet });
    return NextResponse.json({ success: true, data: { id: replyId } });
  } catch (error) {
    logger.error('[post-reply] delete failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to remove reply' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
