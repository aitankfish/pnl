/**
 * /api/markets/[id]/posts/[postId]/replies
 *
 * GET  — public: list active replies on a post (oldest first).
 * POST — any authenticated user: reply to a post.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ProjectPost, PostReply, UserProfile } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();
const MAX_BODY = 1000;

function serialize(r: any, name?: string | null) {
  return {
    id: String(r._id),
    authorWallet: r.authorWallet,
    displayName: name ?? r.displayName ?? null,
    body: r.body,
    createdAt: r.createdAt,
  };
}

// Server-authoritative username lookup (verified profiles keyed by wallet), so
// reply names can never be spoofed by the client and reflect the current name.
async function resolveNames(wallets: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(wallets)];
  if (!unique.length) return new Map();
  const profiles = await UserProfile.find({ walletAddress: { $in: unique } })
    .select('walletAddress username')
    .lean<any[]>();
  return new Map(profiles.filter((p) => p.username).map((p) => [p.walletAddress, p.username]));
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
    const names = await resolveNames(replies.map((r) => r.authorWallet));
    return NextResponse.json({
      success: true,
      data: { replies: replies.map((r) => serialize(r, names.get(r.authorWallet))) },
    });
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

    // displayName is resolved server-side from the caller's verified profile —
    // never taken from the client (which could spoof another user's name).
    const name = (await resolveNames([authUser.walletAddress])).get(authUser.walletAddress);
    const reply = await PostReply.create({
      postId,
      marketAddress: post.marketAddress,
      authorWallet: authUser.walletAddress,
      displayName: name,
      body,
      status: 'active',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, data: serialize(reply.toObject(), name) });
  } catch (error) {
    logger.error('[post-reply] create failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to post reply' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
