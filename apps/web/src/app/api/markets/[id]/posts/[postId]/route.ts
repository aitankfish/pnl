/**
 * /api/markets/[id]/posts/[postId]
 *
 * PATCH  — founder: edit a post's body or toggle pin.
 * DELETE — founder (own post) or platform admin: hide it (reversible —
 *          status:'hidden', drops out of the feed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ProjectPost } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { isPlatformAdmin } from '@/lib/admin';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();
const MAX_BODY = 5000;

export const PATCH = withAuth(async (request: NextRequest, authUser, { params }: any) => {
  try {
    const { postId } = await params;
    if (!Types.ObjectId.isValid(postId)) return bad('Invalid post id');

    await connectToDatabase();
    const post = await ProjectPost.findById(postId);
    if (!post || post.status !== 'active') return bad('Post not found', 404);
    if (post.authorWallet !== authUser.walletAddress) {
      return bad('Only the author can edit this post', 403);
    }

    const json = await request.json().catch(() => ({}));
    let changed = false;
    if (typeof json.body === 'string') {
      const body = json.body.trim();
      if (body.length > MAX_BODY) return bad(`Post is too long (max ${MAX_BODY})`);
      post.body = body || undefined;
      post.editedAt = new Date();
      changed = true;
    }
    if (typeof json.pinned === 'boolean') {
      post.pinned = json.pinned;
      changed = true;
    }
    if (changed) {
      post.updatedAt = new Date();
      await post.save();
    }
    return NextResponse.json({ success: true, data: { id: postId } });
  } catch (error) {
    logger.error('[project-post] edit failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to edit post' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_request: NextRequest, authUser, { params }: any) => {
  try {
    const { postId } = await params;
    if (!Types.ObjectId.isValid(postId)) return bad('Invalid post id');

    await connectToDatabase();
    const post = await ProjectPost.findById(postId);
    if (!post) return bad('Post not found', 404);

    const isAuthor = post.authorWallet === authUser.walletAddress;
    if (!isAuthor && !isPlatformAdmin(authUser.walletAddress)) {
      return bad('Only the author or an admin can remove this post', 403);
    }

    post.status = 'hidden';
    post.updatedAt = new Date();
    await post.save();
    logger.info('[project-post] hidden', { postId, by: authUser.walletAddress });
    return NextResponse.json({ success: true, data: { id: postId } });
  } catch (error) {
    logger.error('[project-post] delete failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to remove post' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
