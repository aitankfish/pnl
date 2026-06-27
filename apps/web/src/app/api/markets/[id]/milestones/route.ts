/**
 * /api/markets/[id]/milestones
 *
 * GET  — public: list a project's milestones, running lazy git settlement
 *        first (a matching release/tag ships a milestone; a passed deadline
 *        misses it). Returns the founder wallet so the UI can gate the
 *        declare form.
 * POST — founder-only: declare a milestone (title, deadline, git trigger).
 *
 * Off-chain status only — this never settles the on-chain stake.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PredictionMarket, Project, Milestone } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { settleMilestones, serializeMilestone } from '@/lib/services/milestone-service';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const MAX_TITLE = 140;
const MAX_DETAIL = 500;
const MAX_MATCH = 120;
const MAX_OPEN = 12; // a roadmap, not a backlog dump
const TRIGGERS = ['release', 'tag', 'manual'] as const;

async function resolveMarketAndProject(id: string) {
  const market = await PredictionMarket.findOne(
    Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
  ).lean<any>();
  if (!market) return { market: null, project: null };
  const project = market.projectId ? await Project.findById(market.projectId).lean<any>() : null;
  return { market, project };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const { market, project } = await resolveMarketAndProject(id);
    if (!market) return bad('Market not found', 404);

    const projectId = market.projectId ? String(market.projectId) : undefined;
    const milestones = await settleMilestones(market.marketAddress, projectId);

    const founderWallet = project?.founderWallet || market.founderWallet || null;
    return NextResponse.json({
      success: true,
      data: { milestones: milestones.map(serializeMilestone), founderWallet },
    });
  } catch (error) {
    logger.error('[milestones] list failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load milestones' }, { status: 500 });
  }
}

export const POST = withAuth(async (request: NextRequest, authUser, { params }: any) => {
  try {
    const { id } = await params;
    const rateLimited = await checkRateLimit(`milestone:${authUser.walletAddress}`, 20, 60_000);
    if (rateLimited) return rateLimited;

    await connectToDatabase();
    const { market, project } = await resolveMarketAndProject(id);
    if (!market) return bad('Market not found', 404);

    const founderWallet = project?.founderWallet || market.founderWallet;
    if (founderWallet !== authUser.walletAddress) {
      return bad('Only the founder can declare milestones', 403);
    }

    const json = await request.json().catch(() => ({}));
    const title = String(json?.title || '').trim();
    if (!title) return bad('Milestone needs a title');
    if (title.length > MAX_TITLE) return bad(`Title too long (max ${MAX_TITLE})`);

    const detail = String(json?.detail || '').trim().slice(0, MAX_DETAIL) || undefined;

    const targetDate = new Date(json?.targetDate);
    if (isNaN(targetDate.getTime())) return bad('Invalid target date');
    if (targetDate.getTime() < Date.now()) return bad('Target date must be in the future');

    const triggerType = TRIGGERS.includes(json?.triggerType) ? json.triggerType : 'manual';
    let triggerMatch: string | undefined;
    if (triggerType === 'release' || triggerType === 'tag') {
      triggerMatch = String(json?.triggerMatch || '').trim().slice(0, MAX_MATCH);
      if (!triggerMatch) return bad('A git-settled milestone needs a tag or release name to match');
    }

    const openCount = await Milestone.countDocuments({ marketAddress: market.marketAddress, status: 'open' });
    if (openCount >= MAX_OPEN) return bad(`Too many open milestones (max ${MAX_OPEN})`);

    const total = await Milestone.countDocuments({ marketAddress: market.marketAddress });
    const now = new Date();
    const created = await Milestone.create({
      marketAddress: market.marketAddress,
      projectId: market.projectId ? String(market.projectId) : undefined,
      founderWallet: authUser.walletAddress,
      title,
      detail,
      targetDate,
      triggerType,
      triggerMatch,
      status: 'open',
      order: total,
      createdAt: now,
      updatedAt: now,
    });

    logger.info('[milestones] created', { marketAddress: market.marketAddress, milestoneId: created._id });
    return NextResponse.json({ success: true, data: serializeMilestone(created.toObject()) });
  } catch (error) {
    logger.error('[milestones] create failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to declare milestone' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
