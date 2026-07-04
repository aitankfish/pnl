/**
 * GET /api/markets/[id]/views — founder- or admin-only view stats for a market.
 *
 * Returns total views (human/agent split) plus views since the founder's last
 * update — the pull signal: "did posting move the number?" Private by design;
 * a pre-demand count shouldn't read as "dead" to a visitor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PredictionMarket, Project, ProjectPost } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { isPlatformAdmin } from '@/lib/admin';
import { marketViewStats } from '@/lib/services/metrics-service';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export const GET = withAuth(async (_req: NextRequest, authUser, { params }: any) => {
  try {
    const { id } = await params;
    await connectToDatabase();
    const market = await PredictionMarket.findOne(
      Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
    ).lean<any>();
    if (!market) return NextResponse.json({ success: false, error: 'Market not found' }, { status: 404 });

    const project = market.projectId ? await Project.findById(market.projectId).lean<any>() : null;
    const founderWallet = project?.founderWallet || market.founderWallet;
    if (founderWallet !== authUser.walletAddress && !isPlatformAdmin(authUser.walletAddress)) {
      return NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 });
    }

    const total = await marketViewStats(market.marketAddress);

    // Views since the last published update — the "did posting pull anyone" signal.
    const lastPost = await ProjectPost.findOne({ marketAddress: market.marketAddress, status: 'active' })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean<any>();
    const sinceLastUpdate = lastPost?.createdAt
      ? await marketViewStats(market.marketAddress, new Date(lastPost.createdAt))
      : total;

    return NextResponse.json({
      success: true,
      data: { total, sinceLastUpdate, hasUpdate: !!lastPost },
    });
  } catch (error) {
    logger.error('[market-views] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load views' }, { status: 500 });
  }
});
