/**
 * POST /api/markets/[id]/draft-update
 *
 * Founder-only. Reads the project's linked repo (through its thesis citation),
 * pulls recent commits, and asks the founder's OWN BYOK model to draft a short
 * build-in-public update from them. Returns the draft text ONLY — it writes
 * nothing. The founder edits the draft in the composer and publishes it via
 * POST /posts.
 *
 * This is step 3 of the agentic-github layer (auto-artifact refresh), scoped to
 * "draft into Updates" — the LLM proposes, the founder disposes; it never
 * overwrites the human-authored thesis paper. See
 * docs/plans/AGENTIC_GITHUB_LAYER_DESIGN.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { generateText, type LanguageModel } from 'ai';
import { connectToDatabase, PredictionMarket, Project } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { ghCachedFetch } from '@/lib/github';
import { resolveThesisRepo } from '@/lib/services/milestone-service';
import { buildModel, readByok } from '@/lib/agent/byok-server';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const logger = createClientLogger();

const COMMITS_CACHE_SECONDS = 5 * 60;
const MAX_COMMITS = 25;

interface GhCommit {
  sha: string;
  commit: { message: string; author: { date: string | null } | null };
}

const SYSTEM = `You draft a short "build-in-public" update for a project's backers, from its recent git commits.

Voice: the founder's own — first person plural ("we"), plain, factual, concrete. No hype, no marketing adjectives, no emoji, no title, no sign-off.
Length: 2–4 sentences, or up to 4 short bullet points if the work splits cleanly.
Substance: say what actually changed and why it matters to someone following the build. Group related commits into one thread. Skip noise — merge commits, CI, formatting, dependency and version bumps — unless that's genuinely all that happened.
Honesty: never invent a feature, number, or outcome that isn't in the commits. If the commits are thin or unclear, write a shorter, humbler update rather than embellishing.
Output ONLY the update text the founder will edit — nothing else.`;

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * GET — cheap "can this project be drafted from?" probe. DB-only (no GitHub
 * call, no model): resolves the thesis repo so the composer can hide the draft
 * button on projects with no linked repo. The repo link is already public, so
 * this needs no auth.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const market = await PredictionMarket.findOne(
      Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
    )
      .select('projectId')
      .lean<any>();
    if (!market) return bad('Market not found', 404);

    const repo = market.projectId ? await resolveThesisRepo(String(market.projectId)) : null;
    return NextResponse.json({
      success: true,
      data: { hasRepo: !!repo, repo: repo ? `${repo.owner}/${repo.repo}` : null },
    });
  } catch (error) {
    logger.error('[draft-update] probe failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to check repo' }, { status: 500 });
  }
}

export const POST = withAuth(async (request: NextRequest, authUser, { params }: any) => {
  try {
    const { id } = await params;

    // The model runs on the caller's own key, but still throttle abuse.
    const limited = await checkRateLimit(`draft-update:${authUser.walletAddress}`, 10, 60_000);
    if (limited) return limited;

    const { provider, apiKey, model } = readByok(request);
    if (!provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'no_key', message: 'Add your own AI provider key in Settings to draft updates.' },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const market = await PredictionMarket.findOne(
      Types.ObjectId.isValid(id) ? { _id: id } : { marketAddress: id },
    ).lean<any>();
    if (!market) return bad('Market not found', 404);

    const project = market.projectId ? await Project.findById(market.projectId).lean<any>() : null;
    const founderWallet = project?.founderWallet || market.founderWallet;
    if (founderWallet !== authUser.walletAddress) {
      return bad('Only the founder can draft updates', 403);
    }

    if (!market.projectId) {
      return bad('This project has no linked repo to draft from.', 422);
    }
    const repo = await resolveThesisRepo(String(market.projectId));
    if (!repo) {
      return bad('No linked repo — cite a thesis paper with a GitHub URL to draft from its commits.', 422);
    }

    const commitsRes = await ghCachedFetch<GhCommit[]>(
      `/repos/${repo.owner}/${repo.repo}/commits?per_page=${MAX_COMMITS}`,
      { cacheKey: `commits:${repo.owner}/${repo.repo}`, ttlSeconds: COMMITS_CACHE_SECONDS },
    );
    if (commitsRes.kind === 'rate-limited') return bad('GitHub rate limit hit — try again in a few minutes.', 429);
    if (commitsRes.kind === 'not-found') return bad('The linked repo isn’t reachable (private or moved).', 404);
    if (commitsRes.kind !== 'ok') return bad('Couldn’t read the repo’s commits.', 502);

    // First line only, drop merge commits — they carry no build signal.
    const commits = (commitsRes.data || [])
      .map((c) => ({
        message: (c.commit?.message || '').split('\n')[0].trim(),
        date: c.commit?.author?.date || null,
      }))
      .filter((c) => c.message && !/^merge\b/i.test(c.message));

    if (commits.length === 0) {
      return bad('No substantive commits to summarize yet.', 422);
    }

    const commitList = commits
      .map((c) => `- ${c.message}${c.date ? ` (${c.date.slice(0, 10)})` : ''}`)
      .join('\n');

    let languageModel: LanguageModel;
    try {
      languageModel = buildModel(provider, apiKey, model);
    } catch (e) {
      return bad(e instanceof Error ? e.message : 'invalid provider', 400);
    }

    let draft: string;
    try {
      const result = await generateText({
        model: languageModel,
        system: SYSTEM,
        prompt: `Repo: ${repo.owner}/${repo.repo}\nRecent commits (newest first):\n${commitList}\n\nDraft the update.`,
        maxOutputTokens: 400,
      });
      draft = result.text.trim();
    } catch (e) {
      // Provider-side failure (bad key, quota, model id). Surface a clean message.
      logger.error('[draft-update] model call failed', { error: e instanceof Error ? e.message : String(e) });
      return bad('Your AI provider rejected the request — check your key and model in Settings.', 502);
    }

    if (!draft) return bad('The model returned an empty draft — try again.', 502);

    logger.info('[draft-update] drafted', {
      marketAddress: market.marketAddress,
      repo: `${repo.owner}/${repo.repo}`,
      commits: commits.length,
    });

    return NextResponse.json({
      success: true,
      data: { draft, repo: `${repo.owner}/${repo.repo}`, commitCount: commits.length },
    });
  } catch (error) {
    logger.error('[draft-update] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to draft the update' }, { status: 500 });
  }
});
