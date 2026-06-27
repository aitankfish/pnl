/**
 * /api/markets/[id]/posts/[postId]/replies
 *
 * GET  — public: list active replies on a post (oldest first).
 * POST — any authenticated user: reply to a post.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ProjectPost, PostReply } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();
const MAX_BODY = 1000;

function serialize(r: any) {
  return {
    id: String(r._id),
    authorWallet: r.authorWallet,
    displayName: r.displayName || null,
    body: r.body,
    createdAt: r.createdAt,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params;
    if (!Types.ObjectId.isValid(postId)) return bad('Invalid post id');
    await connectToDatabase();
    const replies = await PostReply.find({ postId, status: 'active' })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean<any[]>();
    return NextResponse.json({ success: true, data: { replies: replies.map(serialize) } });
  } catch (error) {
    logger.error('[post-reply] list failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load replies' }, { status: 500 });
  }
}

export const POST = withAuth(async (request: NextRequest, authUser, { params }: any) => {
  try {
    const { postId } = await params;
    if (!Types.ObjectId.isValid(postId)) return bad('Invalid post id');

    const rateLimited = await checkRateLimit(`post-reply:${authUser.walletAddress}`, 20, 60_000);
    if (rateLimited) return rateLimited;

    await connectToDatabase();
    const post = await ProjectPost.findById(postId).lean<any>();
    if (!post || post.status !== 'active') return bad('Post not found', 404);

    const json = await request.json().catch(() => ({}));
    const body = String(json?.body || '').trim();
    if (!body) return bad('Reply cannot be empty');
    if (body.length > MAX_BODY) return bad(`Reply is too long (max ${MAX_BODY})`);
    const displayName = String(json?.displayName || '').trim().slice(0, 60) || undefined;

    const reply = await PostReply.create({
      postId,
      marketAddress: post.marketAddress,
      authorWallet: authUser.walletAddress,
      displayName,
      body,
      status: 'active',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, data: serialize(reply.toObject()) });
  } catch (error) {
    logger.error('[post-reply] create failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to post reply' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
