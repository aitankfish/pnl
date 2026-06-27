/**
 * /api/markets/[id]/reactions
 *
 * POST — authed: toggle an emoji reaction on a post or one of its replies.
 *        Body: { targetType: 'post' | 'reply', targetId, emoji }. Inserting a
 *        row reacts; a second call with the same emoji removes it. The target
 *        is verified to belong to THIS market (no cross-market reactions).
 *
 * Reaction COUNTS are folded into the posts / replies GET responses, so there
 * is no GET here — this route only mutates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PredictionMarket, ProjectPost, PostReply, PostReaction } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

// A small, curated palette keeps the feed legible and blocks arbitrary glyphs.
export const ALLOWED_EMOJI = ['🔥', '🚀', '👏', '🧠', '👀', '❤️'];

export const POST = withAuth(async (request: NextRequest, authUser, { params }: any) => {
  try {
    const { id } = await params;
    const rateLimited = await checkRateLimit(`post-reaction:${authUser.walletAddress}`, 60, 60_000);
    if (rateLimited) return rateLimited;

    const json = await request.json().catch(() => ({}));
    const targetType = json.targetType === 'reply' ? 'reply' : json.targetType === 'post' ? 'post' : null;
    const targetId = typeof json.targetId === 'string' ? json.targetId : '';
    const emoji = typeof json.emoji === 'string' ? json.emoji : '';

    if (!targetType) return bad('targetType must be "post" or "reply"');
    if (!Types.ObjectId.isValid(targetId)) return bad('Invalid targetId');
    if (!ALLOWED_EMOJI.includes(emoji)) return bad('Unsupported reaction');

    await connectToDatabase();
    const market = await PredictionMarket.findOne(
      Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
    ).lean<any>();
    if (!market) return bad('Market not found', 404);

    // The target must live in this market — blocks reacting across markets.
    if (targetType === 'post') {
      const post = await ProjectPost.findById(targetId).select('marketAddress status').lean<any>();
      if (!post || post.status !== 'active' || post.marketAddress !== market.marketAddress) {
        return bad('Post not found', 404);
      }
    } else {
      const reply = await PostReply.findById(targetId).select('marketAddress status').lean<any>();
      if (!reply || reply.status !== 'active' || reply.marketAddress !== market.marketAddress) {
        return bad('Reply not found', 404);
      }
    }

    const filter = { targetType, targetId, walletAddress: authUser.walletAddress, emoji };
    const existing = await PostReaction.findOne(filter);
    let reacted: boolean;
    if (existing) {
      await existing.deleteOne();
      reacted = false;
    } else {
      try {
        await PostReaction.create({ ...filter, marketAddress: market.marketAddress });
        reacted = true;
      } catch (e: any) {
        // Duplicate-key from a double-tap race — treat as already reacted.
        if (e?.code === 11000) reacted = true;
        else throw e;
      }
    }

    // Return the fresh counts for this one target so the UI can reconcile.
    const rows = await PostReaction.find({ targetType, targetId }).select('emoji walletAddress').lean<any[]>();
    const counts: Record<string, number> = {};
    const mine: string[] = [];
    for (const r of rows) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      if (r.walletAddress === authUser.walletAddress) mine.push(r.emoji);
    }

    return NextResponse.json({ success: true, data: { reacted, emoji, counts, mine } });
  } catch (error) {
    logger.error('[post-reaction] toggle failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to react' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
