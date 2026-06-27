/**
 * /api/markets/[id]/posts
 *
 * POST  — founder-only: publish a build-in-public update (text + optional
 *         images). Mirrors the media route's founder gate.
 * GET    — public: list a market's active posts, pinned first, newest first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PredictionMarket, Project, ProjectPost } from '@/lib/mongodb';
import { ipfsUtils } from '@/lib/ipfs';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const MAX_BODY = 5000;
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function resolveMarketAndProject(id: string) {
  const market = await PredictionMarket.findOne(
    Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
  ).lean<any>();
  if (!market) return { market: null, project: null };
  const project = market.projectId ? await Project.findById(market.projectId).lean<any>() : null;
  return { market, project };
}

function serialize(p: any) {
  return {
    id: String(p._id),
    authorWallet: p.authorWallet,
    body: p.body || '',
    media: (p.media || []).map((m: any) => ({
      url: convertToGatewayUrl(m.url) || m.url,
      kind: m.kind || 'image',
    })),
    sourceUrl: p.sourceUrl || null,
    pinned: !!p.pinned,
    editedAt: p.editedAt || null,
    createdAt: p.createdAt,
  };
}

export const POST = withAuth(async (request: NextRequest, authUser, { params }: any) => {
  try {
    const { id } = await params;
    const rateLimited = await checkRateLimit(`project-post:${authUser.walletAddress}`, 10, 60_000);
    if (rateLimited) return rateLimited;

    await connectToDatabase();
    const { market, project } = await resolveMarketAndProject(id);
    if (!market) return bad('Market not found', 404);

    const founderWallet = project?.founderWallet || market.founderWallet;
    if (founderWallet !== authUser.walletAddress) {
      return bad('Only the founder can post updates', 403);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) return bad('Expected multipart/form-data');
    const formData = await request.formData();

    const body = (formData.get('body') as string | null)?.trim() || '';
    if (body.length > MAX_BODY) return bad(`Post is too long (max ${MAX_BODY})`);

    const media: { url: string; kind: string }[] = [];
    for (let i = 0; i < MAX_IMAGES; i++) {
      const f = formData.get(`image${i}`) as File | null;
      if (!f || f.size === 0) continue;
      if (f.size > MAX_IMAGE_SIZE) return bad(`Image ${i + 1} too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) return bad(`Image ${i + 1} type not allowed`);
      media.push({ url: await ipfsUtils.uploadImage(f), kind: 'image' });
    }

    if (!body && media.length === 0) return bad('A post needs text or an image');

    const now = new Date();
    const post = await ProjectPost.create({
      marketAddress: market.marketAddress,
      projectId: market.projectId ? String(market.projectId) : undefined,
      authorWallet: authUser.walletAddress,
      body: body || undefined,
      media,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    logger.info('[project-post] created', { marketAddress: market.marketAddress, postId: post._id });
    return NextResponse.json({ success: true, data: serialize(post.toObject()) });
  } catch (error) {
    logger.error('[project-post] create failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to publish update' }, { status: 500 });
  }
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const { market } = await resolveMarketAndProject(id);
    if (!market) return bad('Market not found', 404);

    const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') || '30', 10), 100);
    const posts = await ProjectPost.find({ marketAddress: market.marketAddress, status: 'active' })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(limit)
      .lean<any[]>();

    return NextResponse.json({
      success: true,
      data: { posts: posts.map(serialize), founderWallet: market.founderWallet || null },
    });
  } catch (error) {
    logger.error('[project-post] list failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load updates' }, { status: 500 });
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
