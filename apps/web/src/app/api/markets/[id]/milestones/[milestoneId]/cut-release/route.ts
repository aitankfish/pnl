/**
 * POST /api/markets/[id]/milestones/[milestoneId]/cut-release
 *
 * Founder-only: cut a real GitHub release for a git-triggered milestone, using
 * the PNL GitHub App installed on the repo owner. Creating the release (tag =
 * the milestone's triggerMatch) is the "act" that the settlement watches —
 * here we also settle the milestone inline since we just made the exact tag.
 *
 * Works from the browser or a linked terminal (device token), since it's a
 * normal withAuth endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, PredictionMarket, Project, Milestone, GithubInstallation } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { resolveThesisRepo } from '@/lib/services/milestone-service';
import { getGithubAppConfig, getInstallationToken, createRelease } from '@/lib/github-app';
import { isXConfigured, postToX, xHandleFrom } from '@/lib/x-service';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const POST = withAuth(async (_request: NextRequest, authUser, { params }: any) => {
  try {
    const { id, milestoneId } = await params;
    if (!Types.ObjectId.isValid(milestoneId)) return bad('Invalid milestone id');

    const cfg = getGithubAppConfig();
    if (!cfg) return bad('GitHub is not configured on this deployment', 503);

    const rateLimited = await checkRateLimit(`cut-release:${authUser.walletAddress}`, 10, 60 * 60_000);
    if (rateLimited) return rateLimited;

    await connectToDatabase();
    const market = await PredictionMarket.findOne(
      Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
    ).lean<any>();
    if (!market) return bad('Market not found', 404);

    const project = market.projectId
      ? await Project.findById(market.projectId).select('founderWallet name socialLinks').lean<any>()
      : null;
    const founderWallet = project?.founderWallet || market.founderWallet;
    if (founderWallet !== authUser.walletAddress) return bad('Only the founder can cut a release', 403);

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone || milestone.marketAddress !== market.marketAddress) return bad('Milestone not found', 404);
    if (milestone.status !== 'open') return bad('That milestone is already settled', 409);
    if (milestone.triggerType === 'manual' || !milestone.triggerMatch) {
      return bad('This milestone settles manually, not from a git release', 422);
    }

    const repo = market.projectId ? await resolveThesisRepo(String(market.projectId)) : null;
    if (!repo) return bad('No linked repository to release on (cite a thesis paper with a GitHub repo)', 404);

    // The installation must belong to THIS caller AND cover the repo owner.
    // Without the wallet constraint, any founder could cut releases on any repo
    // whose owner happened to install the app — even one they don't control.
    const installation = await GithubInstallation.findOne({
      walletAddress: authUser.walletAddress,
      accountLogin: new RegExp(`^${escapeRegex(repo.owner)}$`, 'i'),
      status: 'active',
    }).lean<any>();
    if (!installation) {
      return bad(`Install the PNL GitHub App on "${repo.owner}" from your own account first, then try again`, 409);
    }

    const token = await getInstallationToken(cfg, installation.installationId);
    if (!token) return bad('Couldn’t authenticate with GitHub — the installation may have been removed', 502);

    const result = await createRelease(token, {
      owner: repo.owner,
      repo: repo.repo,
      tagName: milestone.triggerMatch,
      name: milestone.title,
      body: `${milestone.detail || ''}\n\n— shipped via a PNL milestone`.trim(),
    });
    if (!result.ok) {
      return bad(result.error || 'GitHub rejected the release', result.status && result.status < 500 ? 422 : 502);
    }

    // We just created the exact tag — settle the milestone now.
    milestone.status = 'shipped';
    milestone.evidenceUrl = result.htmlUrl || milestone.evidenceUrl;
    milestone.shippedAt = new Date();
    milestone.updatedAt = new Date();
    await milestone.save();

    // Best-effort: broadcast the achievement to X, tagging the project. No-ops
    // unless X is configured; never blocks/fails the release on a tweet hiccup.
    let broadcastUrl: string | null = null;
    try {
      if (isXConfigured()) {
        const handle = xHandleFrom(project?.socialLinks);
        const name = project?.name || 'A PNL project';
        const tag = handle ? ` @${handle}` : '';
        const tweet = `🚀 ${name} shipped: ${milestone.title}${result.htmlUrl ? ` — ${result.htmlUrl}` : ''}${tag}`;
        const posted = await postToX(tweet);
        if (posted.ok) broadcastUrl = posted.url || null;
      }
    } catch (e) {
      logger.error('[cut-release] X broadcast failed', e as any);
    }

    logger.info('[cut-release] released + settled', { milestoneId, repo: `${repo.owner}/${repo.repo}`, tag: result.tagName });
    return NextResponse.json({ success: true, data: { releaseUrl: result.htmlUrl, tag: result.tagName, broadcastUrl } });
  } catch (error) {
    logger.error('[cut-release] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to cut release' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
