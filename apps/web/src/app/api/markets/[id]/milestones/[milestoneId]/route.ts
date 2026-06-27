/**
 * /api/markets/[id]/milestones/[milestoneId]
 *
 * PATCH  — founder: edit an OPEN milestone (title/detail/date/trigger), or
 *          manually mark a 'manual'-trigger milestone shipped with evidence.
 * DELETE — founder: remove an OPEN milestone.
 *
 * Trust guard: a 'shipped' or 'missed' milestone is frozen — it can't be
 * edited, re-settled, or deleted, so a founder can never erase a miss or
 * rewrite history. Git-triggered milestones only ship from the git signal,
 * never by hand.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PredictionMarket, Project, Milestone } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { safeExternalUrl } from '@/lib/safe-url';
import { serializeMilestone } from '@/lib/services/milestone-service';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const MAX_TITLE = 140;
const MAX_DETAIL = 500;
const MAX_MATCH = 120;
const TRIGGERS = ['release', 'tag', 'manual'] as const;

async function founderFor(id: string): Promise<{ marketAddress: string; founderWallet: string | null } | null> {
  const market = await PredictionMarket.findOne(
    Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
  ).lean<any>();
  if (!market) return null;
  const project = market.projectId ? await Project.findById(market.projectId).select('founderWallet').lean<any>() : null;
  return { marketAddress: market.marketAddress, founderWallet: project?.founderWallet || market.founderWallet || null };
}

export const PATCH = withAuth(async (request: NextRequest, authUser, { params }: any) => {
  try {
    const { id, milestoneId } = await params;
    if (!Types.ObjectId.isValid(milestoneId)) return bad('Invalid milestone id');

    await connectToDatabase();
    const ctx = await founderFor(id);
    if (!ctx) return bad('Market not found', 404);
    if (ctx.founderWallet !== authUser.walletAddress) return bad('Only the founder can edit milestones', 403);

    const m = await Milestone.findById(milestoneId);
    if (!m || m.marketAddress !== ctx.marketAddress) return bad('Milestone not found', 404);
    if (m.status !== 'open') return bad('A settled milestone is frozen and can’t be changed', 409);

    const json = await request.json().catch(() => ({}));

    // Manual settle: founder marks a manual-trigger milestone shipped, with proof.
    if (json?.markShipped === true) {
      if (m.triggerType !== 'manual') {
        return bad('Git-settled milestones ship from the release/tag, not by hand', 422);
      }
      const evidence = safeExternalUrl(String(json?.evidenceUrl || '').trim());
      if (!evidence) return bad('Marking shipped needs a valid evidence link');
      m.status = 'shipped';
      m.evidenceUrl = evidence;
      m.shippedAt = new Date();
      m.updatedAt = new Date();
      await m.save();
      return NextResponse.json({ success: true, data: serializeMilestone(m.toObject()) });
    }

    // Otherwise, an edit of the open milestone's fields.
    if (typeof json.title === 'string') {
      const title = json.title.trim();
      if (!title) return bad('Title can’t be empty');
      if (title.length > MAX_TITLE) return bad(`Title too long (max ${MAX_TITLE})`);
      m.title = title;
    }
    if (typeof json.detail === 'string') {
      m.detail = json.detail.trim().slice(0, MAX_DETAIL) || undefined;
    }
    if (json.targetDate !== undefined) {
      const d = new Date(json.targetDate);
      if (isNaN(d.getTime())) return bad('Invalid target date');
      if (d.getTime() < Date.now()) return bad('Target date must be in the future');
      m.targetDate = d;
    }
    if (typeof json.triggerType === 'string') {
      if (!TRIGGERS.includes(json.triggerType)) return bad('Invalid trigger type');
      m.triggerType = json.triggerType;
    }
    if (m.triggerType === 'release' || m.triggerType === 'tag') {
      // Trigger match may be supplied here or must already exist.
      if (typeof json.triggerMatch === 'string') {
        m.triggerMatch = json.triggerMatch.trim().slice(0, MAX_MATCH);
      }
      if (!m.triggerMatch) return bad('A git-settled milestone needs a tag or release name to match');
    } else {
      m.triggerMatch = undefined;
    }

    m.updatedAt = new Date();
    await m.save();
    return NextResponse.json({ success: true, data: serializeMilestone(m.toObject()) });
  } catch (error) {
    logger.error('[milestones] edit failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to edit milestone' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_request: NextRequest, authUser, { params }: any) => {
  try {
    const { id, milestoneId } = await params;
    if (!Types.ObjectId.isValid(milestoneId)) return bad('Invalid milestone id');

    await connectToDatabase();
    const ctx = await founderFor(id);
    if (!ctx) return bad('Market not found', 404);
    if (ctx.founderWallet !== authUser.walletAddress) return bad('Only the founder can remove milestones', 403);

    const m = await Milestone.findById(milestoneId);
    if (!m || m.marketAddress !== ctx.marketAddress) return bad('Milestone not found', 404);
    if (m.status !== 'open') return bad('A settled milestone is part of the record and can’t be deleted', 409);

    await m.deleteOne();
    logger.info('[milestones] deleted', { milestoneId, by: authUser.walletAddress });
    return NextResponse.json({ success: true, data: { id: milestoneId } });
  } catch (error) {
    logger.error('[milestones] delete failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to remove milestone' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
