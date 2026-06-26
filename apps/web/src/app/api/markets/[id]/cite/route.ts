/**
 * POST /api/markets/[id]/cite
 *
 * Add a citation linking a research paper to a project. The requester must
 * be the project's founder. Citations are auto-accepted when the founder
 * also authored the paper; otherwise they enter `pending` status awaiting
 * the cited author's acceptance (Phase B feature).
 *
 * Body: {
 *   paperId: string,
 *   role?: 'thesis' | 'foundation' | 'reference',
 *   citationNote?: string,   // up to 280 chars
 * }
 *
 * GET /api/markets/[id]/cite
 *   Returns the project's accepted (auto + accepted) citations, grouped by
 *   role. Public endpoint; pending/rejected/withdrawn are never exposed.
 */

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import {
  connectToDatabase,
  PaperCitation,
  PredictionMarket,
  Project,
  ResearchPaper,
} from '@/lib/mongodb';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

type Role = 'thesis' | 'foundation' | 'reference';
const VALID_ROLES: Role[] = ['thesis', 'foundation', 'reference'];

export const POST = withAuth(async (request, authUser, { params }: any) => {
  try {
    const { id } = await params;

    // Two rate limits run in series:
    //   1. Burst: 5 citations per minute per wallet (handles all citations).
    //   2. Daily: 5 cross-author citations per 24h per wallet — tight,
    //      because spammy "cite my favorite paper to look legit" attacks
    //      are the main risk in the cross-author path.
    const rateLimited = await checkRateLimit(
      `cite:${authUser.walletAddress}`,
      5,
      60_000,
    );
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => ({}));
    const paperId = String(body?.paperId || '').trim();
    const roleRaw = String(body?.role || 'reference') as Role;
    const role: Role = VALID_ROLES.includes(roleRaw) ? roleRaw : 'reference';
    const citationNote = String(body?.citationNote || '').trim().slice(0, 280);

    if (!paperId || !Types.ObjectId.isValid(paperId)) {
      return badRequest('Invalid paperId');
    }

    await connectToDatabase();

    const project = await resolveProject(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }
    if (project.founderWallet !== authUser.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Only the project founder can cite papers' },
        { status: 403 },
      );
    }

    const paper = await ResearchPaper.findById(paperId).lean<any>();
    if (!paper || paper.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Paper not found' },
        { status: 404 },
      );
    }

    // Existing citation? Idempotent — return it instead of erroring.
    const existing = await PaperCitation.findOne({
      paperId: paper._id,
      projectId: project._id,
    }).lean<any>();
    if (existing) {
      return NextResponse.json({
        success: true,
        data: serializeCitation(existing, paper),
        existed: true,
      });
    }

    // Same-wallet → auto. Cross-author → pending (awaits author acceptance).
    const sameWallet = paper.authorWallet === authUser.walletAddress;
    const status = sameWallet ? 'auto' : 'pending';

    // Daily cap on cross-author requests. Same-wallet citations skip this
    // because they auto-accept and aren't a spam risk.
    if (!sameWallet) {
      const dailyLimited = await checkRateLimit(
        `cite:cross:${authUser.walletAddress}`,
        5,
        24 * 60 * 60 * 1000,
      );
      if (dailyLimited) return dailyLimited;
    }

    const created = await PaperCitation.create({
      paperId: paper._id,
      projectId: project._id,
      addedBy: authUser.walletAddress,
      paperAuthorWallet: paper.authorWallet,
      status,
      role,
      citationNote: citationNote || undefined,
      acceptedAt: sameWallet ? new Date() : undefined,
    });

    logger.info('[markets/cite] citation created', {
      paperId: String(paper._id),
      projectId: String(project._id),
      role,
      status,
      sameWallet,
    });

    return NextResponse.json({
      success: true,
      data: serializeCitation(created.toObject(), paper),
    });
  } catch (error) {
    logger.error('[markets/cite] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to create citation' },
      { status: 500 },
    );
  }
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const project = await resolveProject(id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }

    // Visible only — auto + accepted.
    const citations = await PaperCitation.find({
      projectId: project._id,
      status: { $in: ['auto', 'accepted'] },
    })
      .sort({ createdAt: 1 })
      .lean<any[]>();

    if (citations.length === 0) {
      return NextResponse.json({ success: true, data: { citations: [] } });
    }

    // Hydrate paper metadata in one query.
    const paperIds = citations.map((c) => c.paperId);
    const papers = await ResearchPaper.find({ _id: { $in: paperIds } }).lean<any[]>();
    const paperById = new Map(papers.map((p) => [String(p._id), p]));

    return NextResponse.json({
      success: true,
      data: {
        citations: citations
          .map((c) => {
            const paper = paperById.get(String(c.paperId));
            if (!paper || paper.status !== 'active') return null;
            return serializeCitation(c, paper);
          })
          .filter(Boolean),
      },
    });
  } catch (error) {
    logger.error('[markets/cite GET] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load citations' },
      { status: 500 },
    );
  }
}

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

/**
 * Resolve a project from a `[id]` segment that could be:
 *  - a Project ObjectId (rare in URLs, but supported)
 *  - a Market ObjectId (common — /market/[id] uses this)
 *  - a Solana marketAddress (also supported by GET /api/markets/[id])
 *
 * Returns the resolved project, or null if nothing matches.
 */
async function resolveProject(id: string): Promise<any | null> {
  // Project ObjectId path.
  if (Types.ObjectId.isValid(id)) {
    const direct = await Project.findById(id).lean<any>();
    if (direct) return direct;
    const market = await PredictionMarket.findById(id).lean<any>();
    if (market) {
      return Project.findById(market.projectId).lean<any>();
    }
  }
  // Solana marketAddress path.
  const market = await PredictionMarket.findOne({ marketAddress: id }).lean<any>();
  if (!market) return null;
  return Project.findById(market.projectId).lean<any>();
}

function serializeCitation(c: any, paper: any) {
  return {
    id: String(c._id),
    paperId: String(paper._id),
    projectId: String(c.projectId),
    role: c.role,
    status: c.status,
    citationNote: c.citationNote || null,
    paper: {
      id: String(paper._id),
      title: paper.title,
      authorName: paper.authorName,
      authorWallet: paper.authorWallet,
      authorXHandle: paper.authorXHandle || null,
      summary: paper.summary || null,
      paperUrl: paper.paperUrl ? convertToGatewayUrl(paper.paperUrl) || paper.paperUrl : null,
      doi: paper.doi || null,
      externalUrl: paper.externalUrl || null,
      currentVersion: paper.currentVersion || 1,
      likeCount: paper.likeCount || 0,
      dislikeCount: paper.dislikeCount || 0,
    },
    sameWallet: c.paperAuthorWallet === c.addedBy,
    createdAt: c.createdAt,
  };
}
