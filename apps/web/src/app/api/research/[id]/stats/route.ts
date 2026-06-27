/**
 * GET /api/research/[id]/stats
 *
 * Public: the paper's external reach (citations · downloads · views) pulled
 * from the open scholarly graph by its DOI, cached. Returns null data when the
 * paper has no DOI to look up — the UI then renders nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { getPaperStats } from '@/lib/services/paper-stats-service';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    await connectToDatabase();
    const paper = await ResearchPaper.findById(id).select('doi status').lean<any>();
    if (!paper || paper.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }
    if (!paper.doi) {
      return NextResponse.json({ success: true, data: { stats: null } });
    }

    const stats = await getPaperStats(paper.doi);
    return NextResponse.json({ success: true, data: { stats } });
  } catch (error) {
    logger.error('[research/stats] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load stats' }, { status: 500 });
  }
}
