/**
 * /api/markets/[id]/posts
 *
 * POST  — founder-only: publish a build-in-public update (text + optional
 *         images). Mirrors the media route's founder gate.
 * GET    — public: list a market's active posts, pinned first, newest first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PredictionMarket, Project, ProjectPost, PostReaction, UserProfile } from '@/lib/mongodb';
import { ipfsUtils } from '@/lib/ipfs';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { safeExternalUrl } from '@/lib/safe-url';
import { notifyProjectUpdate } from '@/lib/services/notification-service';
import { isXConfigured, postToX, xHandleFrom } from '@/lib/x-service';
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

async function nameFor(wallet: string): Promise<string | null> {
  const p = await UserProfile.findOne({ walletAddress: wallet }).select('username').lean<any>();
  return p?.username || null;
}

function serialize(
  p: any,
  authorName?: string | null,
  reactions: Record<string, number> = {},
  mine: string[] = [],
) {
  return {
    id: String(p._id),
    authorWallet: p.authorWallet,
    authorName: authorName ?? null,
    body: p.body || '',
    media: (p.media || []).map((m: any) => ({
      url: convertToGatewayUrl(m.url) || m.url,
      kind: m.kind || 'image',
    })),
    sourceUrl: p.sourceUrl || null,
    pinned: !!p.pinned,
    editedAt: p.editedAt || null,
    createdAt: p.createdAt,
    reactions,
    mine,
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

    // Optional provenance link (e.g. the original X post this was crossposted from).
    const sourceUrlRaw = (formData.get('sourceUrl') as string | null)?.trim() || '';
    let sourceUrl: string | undefined;
    if (sourceUrlRaw) {
      const safe = safeExternalUrl(sourceUrlRaw);
      if (!safe) return bad('Source link must be a valid http(s) URL');
      sourceUrl = safe;
    }

    // Opt-in: also broadcast this update to X from PNL's account.
    const shareToX = (formData.get('shareToX') as string | null) === 'true';

    const media: { url: string; kind: string }[] = [];
    for (let i = 0; i < MAX_IMAGES; i++) {
      const f = formData.get(`image${i}`) as File | null;
      if (!f || f.size === 0) continue;
      if (f.size > MAX_IMAGE_SIZE) return bad(`Image ${i + 1} too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) return bad(`Image ${i + 1} type not allowed`);
      // Don't trust the client MIME — check the actual magic bytes before pinning.
      const magic = new Uint8Array(await f.slice(0, 16).arrayBuffer());
      if (!looksLikeImage(magic)) return bad(`Image ${i + 1} content is not a valid image`);
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
      sourceUrl,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    logger.info('[project-post] created', { marketAddress: market.marketAddress, postId: post._id });

    // Pull the backers back to read + reply. Best-effort; the helper swallows its
    // own errors so a notification hiccup never fails the post.
    try {
      await notifyProjectUpdate(market.marketAddress, body);
    } catch (notifyErr) {
      logger.error('[project-post] notify failed', notifyErr as any);
    }

    // Optional outward broadcast to X. Best-effort — a tweet hiccup never fails
    // the post. No-ops silently unless the founder opted in AND X is configured.
    let broadcastUrl: string | null = null;
    if (shareToX && isXConfigured()) {
      try {
        const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
        const link = `${origin}/market/${market.marketAddress}`;
        const projectName = project?.name || market.name || 'A PNL project';
        const handle = xHandleFrom(project?.socialLinks);
        const tag = handle ? ` @${handle}` : '';
        // Budget the body so the project name, link, and @tag always survive
        // X's 280-char cap; postToX slices as a final backstop.
        const room = 280 - (`${projectName}: `.length + ` — ${link}`.length + tag.length);
        const snippet = body.length > room ? `${body.slice(0, Math.max(0, room - 1))}…` : body;
        const tweet = `${projectName}: ${snippet} — ${link}${tag}`;
        const posted = await postToX(tweet);
        if (posted.ok) broadcastUrl = posted.url || null;
      } catch (xErr) {
        logger.error('[project-post] X broadcast failed', xErr as any);
      }
    }

    const data = serialize(post.toObject(), await nameFor(authUser.walletAddress));
    return NextResponse.json({ success: true, data: { ...data, broadcastUrl } });
  } catch (error) {
    logger.error('[project-post] create failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to publish update' }, { status: 500 });
  }
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const { market, project } = await resolveMarketAndProject(id);
    if (!market) return bad('Market not found', 404);

    const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') || '30', 10), 100);
    const posts = await ProjectPost.find({ marketAddress: market.marketAddress, status: 'active' })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(limit)
      .lean<any[]>();

    // Batch-resolve author display names (server-authoritative usernames).
    const wallets = [...new Set(posts.map((p) => p.authorWallet))];
    const profiles = wallets.length
      ? await UserProfile.find({ walletAddress: { $in: wallets } }).select('walletAddress username').lean<any[]>()
      : [];
    const nameBy = new Map(profiles.filter((p) => p.username).map((p) => [p.walletAddress, p.username]));

    // Fold in emoji reaction counts (+ the viewer's own reactions, if passed).
    const viewer = new URL(request.url).searchParams.get('viewer') || '';
    const postIds = posts.map((p) => String(p._id));
    const reactionRows = postIds.length
      ? await PostReaction.find({ targetType: 'post', targetId: { $in: postIds } })
          .select('targetId emoji walletAddress')
          .lean<any[]>()
      : [];
    const countsBy = new Map<string, Record<string, number>>();
    const mineBy = new Map<string, string[]>();
    for (const r of reactionRows) {
      const c = countsBy.get(r.targetId) || {};
      c[r.emoji] = (c[r.emoji] || 0) + 1;
      countsBy.set(r.targetId, c);
      if (viewer && r.walletAddress === viewer) {
        mineBy.set(r.targetId, [...(mineBy.get(r.targetId) || []), r.emoji]);
      }
    }

    // Resolve the founder the same way create-auth does (project first), so the
    // composer is shown to the real founder even when market.founderWallet diverges.
    const founderWallet = project?.founderWallet || market.founderWallet || null;
    return NextResponse.json({
      success: true,
      data: {
        posts: posts.map((p) =>
          serialize(p, nameBy.get(p.authorWallet), countsBy.get(String(p._id)) || {}, mineBy.get(String(p._id)) || []),
        ),
        founderWallet,
        xConfigured: isXConfigured(),
      },
    });
  } catch (error) {
    logger.error('[project-post] list failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load updates' }, { status: 500 });
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// Magic-byte sniff for the allowed image formats (JPEG/PNG/GIF/WEBP).
function looksLikeImage(b: Uint8Array): boolean {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true; // PNG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true; // GIF8
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return true; // RIFF....WEBP
  return false;
}
