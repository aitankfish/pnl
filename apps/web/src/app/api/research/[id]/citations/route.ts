/**
 * GET /api/research/[id]/citations
 *
 * Public list of every project that visibly cites this paper (status auto
 * or accepted). Powers the "this paper underpins" strip on the paper
 * detail page. Paper authors will eventually get a separate inbox for
 * pending citations in Phase B.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PaperCitation, Project, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 },
      );
    }
    await connectToDatabase();

    const citations = await PaperCitation.find({
      paperId: id,
      status: { $in: ['auto', 'accepted'] },
    })
      .sort({ createdAt: -1 })
      .lean<any[]>();

    if (citations.length === 0) {
      return NextResponse.json({ success: true, data: { citations: [] } });
    }

    const projectIds = citations.map((c) => c.projectId);

    const [projects, markets] = await Promise.all([
      Project.find({ _id: { $in: projectIds } }).lean<any[]>(),
      PredictionMarket.find({ projectId: { $in: projectIds } }).lean<any[]>(),
    ]);

    const projectById = new Map(projects.map((p) => [String(p._id), p]));
    const marketByProject = new Map(
      markets.map((m) => [String(m.projectId), m]),
    );

    return NextResponse.json({
      success: true,
      data: {
        citations: citations
          .map((c) => {
            const project = projectById.get(String(c.projectId));
            if (!project) return null;
            const market = marketByProject.get(String(c.projectId));
            return {
              id: String(c._id),
              role: c.role,
              status: c.status,
              citationNote: c.citationNote || null,
              sameWallet: c.paperAuthorWallet === c.addedBy,
              createdAt: c.createdAt,
              project: {
                id: String(project._id),
                name: project.name,
                tokenSymbol: project.tokenSymbol,
                category: project.category,
                projectImageUrl: project.projectImageUrl || null,
                founderWallet: project.founderWallet,
              },
              market: market
                ? {
                    address: market.marketAddress,
                    state: market.marketState,
                    resolution: market.resolution || 'Unresolved',
                    poolBalance: market.poolBalance || '0',
                    targetPool: market.targetPool || 0,
                    expiryTime: market.expiryTime || null,
                  }
                : null,
            };
          })
          .filter(Boolean),
      },
    });
  } catch (error) {
    logger.error('[research/[id]/citations] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load citations' },
      { status: 500 },
    );
  }
}
