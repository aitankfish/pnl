/**
 * PUT /api/markets/[id]/media
 *
 * Lets a market's founder (re-)upload media AFTER creation, gated to before
 * resolution. Scope: project image, gallery images, pitch video, documents.
 * All off-chain metadata (MongoDB + IPFS/Cloudflare) — does NOT touch the
 * on-chain market account, the immutable on-chain metadataUri, PDAs, or fees.
 *
 * Auth: Privy JWT (withAuth) AND founderWallet === caller. Resolution gate:
 * the market must be Unresolved / active.
 *
 * [id] resolves the same way as GET /api/markets/[id] — a Mongo ObjectId
 * (market._id) or a Solana marketAddress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket, Project } from '@/lib/mongodb';
import { ipfsUtils } from '@/lib/ipfs';
import { uploadToStream } from '@/lib/cloudflare-stream';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { invalidateCache } from '@/lib/redis/invalidate';
import { looksLikeImage, looksLikeVideo, readMagic } from '@/lib/file-sniff';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export const PUT = withAuth(async (
  request: NextRequest,
  authUser,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    // Rate limit: 5 media edits per minute per wallet.
    const rateLimited = await checkRateLimit(`media-edit:${authUser.walletAddress}`, 5, 60_000);
    if (rateLimited) return rateLimited;

    await connectToDatabase();

    // Resolve the market by _id or marketAddress (mirrors GET /api/markets/[id]).
    const market = await PredictionMarket.findOne(
      isValidObjectId(id) ? { _id: id } : { marketAddress: id },
    );
    if (!market) return bad('Market not found', 404);

    const project = await Project.findById(market.projectId);
    if (!project) return bad('Associated project not found', 404);

    // Ownership gate — only the founder may edit. Multipart body, so we check
    // the fetched doc against the verified JWT wallet (not withWalletOwnership,
    // which reads a JSON body field).
    if (project.founderWallet !== authUser.walletAddress) {
      return bad('Only the founder can edit this market’s media', 403);
    }

    // Resolution gate — media is frozen once the market resolves/closes.
    const resolution = market.resolution;
    const isResolved =
      (resolution && resolution !== 'Unresolved') || market.marketState === 1 ||
      market.marketState === 2 || market.marketState === 3;
    if (isResolved) {
      return bad('Cannot edit media on a resolved or closed market', 400);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return bad('Expected multipart/form-data');
    }
    const formData = await request.formData();

    // Track what actually changed so an empty submit is a clean no-op.
    const updates: Record<string, unknown> = {};

    // ── Project image ──
    const imageFile = formData.get('projectImage') as File | null;
    if (imageFile && imageFile.size > 0) {
      if (imageFile.size > MAX_IMAGE_SIZE) return bad(`Image too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) return bad(`Invalid image type: ${imageFile.type}`);
      if (!looksLikeImage(await readMagic(imageFile))) return bad('Image content does not match a supported format (jpeg/png/gif/webp).');
      updates.projectImageUrl = await ipfsUtils.uploadImage(imageFile);
    }

    // ── Gallery images (replace the whole set when any galleryImageN is sent) ──
    const galleryFiles: File[] = [];
    let galleryProvided = false;
    for (let i = 0; i < 3; i++) {
      const gf = formData.get(`galleryImage${i}`) as File | null;
      if (gf && gf.size > 0) {
        galleryProvided = true;
        if (gf.size > MAX_IMAGE_SIZE) return bad(`Gallery image ${i + 1} too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
        if (!ALLOWED_IMAGE_TYPES.includes(gf.type)) return bad(`Invalid gallery image type: ${gf.type}`);
        if (!looksLikeImage(await readMagic(gf))) return bad(`Gallery image ${i + 1} content does not match a supported format.`);
        galleryFiles.push(gf);
      }
    }
    if (galleryProvided) {
      updates.galleryImageUrls = await Promise.all(galleryFiles.map((f) => ipfsUtils.uploadImage(f)));
    }

    // ── Pitch video (uploaded file or a pre-uploaded Stream URL) ──
    const videoFile = formData.get('pitchVideo') as File | null;
    if (videoFile && videoFile.size > 0) {
      if (videoFile.size > MAX_VIDEO_SIZE) return bad(`Video too large (max ${MAX_VIDEO_SIZE / 1024 / 1024}MB)`);
      if (!ALLOWED_VIDEO_TYPES.includes(videoFile.type)) return bad(`Invalid video type: ${videoFile.type}`);
      if (!looksLikeVideo(await readMagic(videoFile))) return bad('Video content does not match a supported format (mp4/mov/webm).');
      const { playbackUrl } = await uploadToStream(videoFile);
      updates.pitchVideoUrl = playbackUrl;
    } else {
      const pitchVideoUrl = formData.get('pitchVideoUrl');
      if (typeof pitchVideoUrl === 'string' && pitchVideoUrl.trim()) {
        updates.pitchVideoUrl = pitchVideoUrl.trim();
      }
    }

    // ── Document (append to documentUrls) ──
    const documentFile = formData.get('projectDocument') as File | null;
    if (documentFile && documentFile.size > 0) {
      const docUri = await ipfsUtils.uploadDocument(documentFile);
      updates.documentUrls = [...(project.documentUrls || []), docUri];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, data: { unchanged: true } });
    }

    updates.updatedAt = new Date();
    await Project.updateOne({ _id: project._id }, { $set: updates });

    // Best-effort cache busts: market list views + this market's detail payload.
    await invalidateCache('markets:list:*', `markets:detail:${String(market._id)}`);

    logger.info('Founder updated market media', {
      marketId: String(market._id),
      projectId: String(project._id),
      fields: Object.keys(updates),
    });

    return NextResponse.json({
      success: true,
      data: {
        projectImageUrl: updates.projectImageUrl ?? project.projectImageUrl,
        galleryImageUrls: updates.galleryImageUrls ?? project.galleryImageUrls,
        pitchVideoUrl: updates.pitchVideoUrl ?? project.pitchVideoUrl,
        documentUrls: updates.documentUrls ?? project.documentUrls,
      },
    });
  } catch (error) {
    logger.error('Failed to update market media', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to update media', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
});
