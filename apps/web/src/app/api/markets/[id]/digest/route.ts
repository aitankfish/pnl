/**
 * POST /api/markets/[id]/digest
 *
 * Founder-only. Gathers the linked repo's recent activity (commits + merged
 * PRs + releases) and asks the LLM to draft a short progress update. Returns
 * the DRAFT only — nothing is persisted. The founder edits and routes it
 * (→ an Updates post, or → a proposed paper-summary revision).
 *
 * `paper` is included so the client knows whether the "propose paper summary"
 * route is available (only when the founder is the cited paper's author).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PredictionMarket, Project, PaperCitation, ResearchPaper } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { parseRepoFromUrl } from '@/lib/github';
import { gatherActivity, activityIsEmpty, draftDigest } from '@/lib/services/digest-service';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const POST = withAuth(async (_request: NextRequest, authUser, { params }: any) => {
  try {
    const { id } = await params;

    // LLM calls cost real tokens — gate hard. 6 drafts per 5 min per wallet.
    const rateLimited = await checkRateLimit(`digest:${authUser.walletAddress}`, 6, 5 * 60_000);
    if (rateLimited) return rateLimited;

    await connectToDatabase();

    const market = await PredictionMarket.findOne(
      Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
    ).lean<any>();
    if (!market) return bad('Market not found', 404);

    const project = market.projectId ? await Project.findById(market.projectId).lean<any>() : null;
    const founderWallet = project?.founderWallet || market.founderWallet;
    if (founderWallet !== authUser.walletAddress) {
      return bad('Only the founder can draft a progress update', 403);
    }

    // Resolve the repo + paper through the thesis citation.
    const thesis = await PaperCitation.findOne({
      projectId: market.projectId,
      role: 'thesis',
      status: { $in: ['auto', 'accepted'] },
    })
      .sort({ createdAt: 1 })
      .lean<any>();
    const paper = thesis ? await ResearchPaper.findById(thesis.paperId).select('githubUrl status authorWallet title').lean<any>() : null;

    if (!paper || paper.status !== 'active' || !paper.githubUrl) {
      return bad('No linked repository — cite a thesis paper with a GitHub repo first', 404);
    }
    const repo = parseRepoFromUrl(paper.githubUrl);
    if (!repo) return bad('The linked repository URL is malformed', 500);

    const activity = await gatherActivity(repo);
    if (activityIsEmpty(activity)) {
      return bad('No recent git activity to summarize yet', 422);
    }

    const draft = await draftDigest(activity);
    if (!draft) {
      return bad('Couldn’t draft an update right now — try again shortly', 503);
    }

    logger.info('[digest] drafted', {
      marketAddress: market.marketAddress,
      commits: activity.commits.length,
      prs: activity.prs.length,
      releases: activity.releases.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        draft,
        stats: {
          commits: activity.commits.length,
          prs: activity.prs.length,
          releases: activity.releases.length,
        },
        repo: `${repo.owner}/${repo.repo}`,
        paper: {
          id: String(paper._id),
          title: paper.title,
          authorWallet: paper.authorWallet,
          isAuthor: paper.authorWallet === authUser.walletAddress,
        },
      },
    });
  } catch (error) {
    logger.error('[digest] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to draft update' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
