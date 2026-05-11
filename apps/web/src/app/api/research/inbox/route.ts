/**
 * GET /api/research/inbox?status=pending
 *
 * Auth-walled. Lists citations addressed to the authenticated wallet
 * (i.e., where this wallet is the cited paper's author). Default scope
 * is `pending`; passing `status=all` includes accepted/rejected for the
 * full activity history.
 *
 * Hydrates paper + project + market so the inbox UI is single-fetch.
 */

import { NextResponse } from 'next/server';
import {
  connectToDatabase,
  PaperCitation,
  PredictionMarket,
  Project,
  ResearchPaper,
} from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const GET = withAuth(async (request, authUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('status') || 'pending').toLowerCase();
    const statuses =
      scope === 'all'
        ? ['pending', 'accepted', 'rejected']
        : ['pending'];

    await connectToDatabase();

    const citations = await PaperCitation.find({
      paperAuthorWallet: authUser.walletAddress,
      status: { $in: statuses },
    })
      .sort({ createdAt: -1 })
      .lean<any[]>();

    if (citations.length === 0) {
      return NextResponse.json({
        success: true,
        data: { citations: [], pendingCount: 0 },
      });
    }

    const paperIds = citations.map((c) => c.paperId);
    const projectIds = citations.map((c) => c.projectId);

    const [papers, projects, markets] = await Promise.all([
      ResearchPaper.find({ _id: { $in: paperIds } }).lean<any[]>(),
      Project.find({ _id: { $in: projectIds } }).lean<any[]>(),
      PredictionMarket.find({ projectId: { $in: projectIds } }).lean<any[]>(),
    ]);

    const paperById = new Map(papers.map((p) => [String(p._id), p]));
    const projectById = new Map(projects.map((p) => [String(p._id), p]));
    const marketByProject = new Map(
      markets.map((m) => [String(m.projectId), m]),
    );

    const hydrated = citations
      .map((c) => {
        const paper = paperById.get(String(c.paperId));
        const project = projectById.get(String(c.projectId));
        if (!paper || !project) return null;
        const market = marketByProject.get(String(c.projectId));
        return {
          id: String(c._id),
          status: c.status,
          role: c.role,
          citationNote: c.citationNote || null,
          createdAt: c.createdAt,
          acceptedAt: c.acceptedAt || null,
          rejectedAt: c.rejectedAt || null,
          paper: {
            id: String(paper._id),
            title: paper.title,
            currentVersion: paper.currentVersion || 1,
          },
          project: {
            id: String(project._id),
            name: project.name,
            tokenSymbol: project.tokenSymbol,
            category: project.category,
            projectImageUrl: project.projectImageUrl || null,
          },
          founder: {
            wallet: c.addedBy,
          },
          market: market
            ? {
                address: market.marketAddress,
                state: market.marketState,
                resolution: market.resolution || 'Unresolved',
                expiryTime: market.expiryTime || null,
              }
            : null,
        };
      })
      .filter(Boolean);

    const pendingCount = hydrated.filter((c: any) => c.status === 'pending').length;

    return NextResponse.json({
      success: true,
      data: {
        citations: hydrated,
        pendingCount,
      },
    });
  } catch (error) {
    logger.error('[research/inbox] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load inbox' },
      { status: 500 },
    );
  }
});
