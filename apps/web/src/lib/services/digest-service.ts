/**
 * Git digest — turns recent repo activity into a human-readable progress draft.
 *
 * Step 3 of the agentic-github layer ("auto-artifact refresh"), done the
 * trust-safe way: the LLM PROPOSES, the founder/author edits and accepts. This
 * module only gathers the git signals and drafts prose — it never persists
 * anything. The caller routes the accepted draft (to an Updates post or a paper
 * summary revision). No raw commit dump: commit messages + merged PR titles +
 * releases go in, a short readable summary comes out.
 */

import { ghCachedFetch, type RepoIdent } from '@/lib/github';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-3';
const CACHE_SECONDS = 5 * 60;

interface GhCommit {
  sha: string;
  commit: { message: string; author: { date: string } | null };
}
interface GhPull {
  title: string;
  merged_at: string | null;
  number: number;
}
interface GhRelease {
  name: string | null;
  tag_name: string;
  draft: boolean;
  published_at: string | null;
}

export interface GitActivity {
  commits: { message: string; date: string | null }[];
  prs: { title: string; mergedAt: string | null }[];
  releases: { name: string; publishedAt: string | null }[];
}

/**
 * Pull recent commits, merged PRs, and releases for a repo. `since` (ISO)
 * scopes commits to activity after the last digest, when provided.
 */
export async function gatherActivity(repo: RepoIdent, since?: string): Promise<GitActivity> {
  const sinceParam = since ? `&since=${encodeURIComponent(since)}` : '';

  const [commitsRes, pullsRes, releasesRes] = await Promise.all([
    ghCachedFetch<GhCommit[]>(
      `/repos/${repo.owner}/${repo.repo}/commits?per_page=40${sinceParam}`,
      { cacheKey: `commits:${repo.owner}/${repo.repo}:${since || 'all'}`, ttlSeconds: CACHE_SECONDS },
    ),
    ghCachedFetch<GhPull[]>(
      `/repos/${repo.owner}/${repo.repo}/pulls?state=closed&per_page=30&sort=updated&direction=desc`,
      { cacheKey: `pulls:${repo.owner}/${repo.repo}:closed`, ttlSeconds: CACHE_SECONDS },
    ),
    ghCachedFetch<GhRelease[]>(
      `/repos/${repo.owner}/${repo.repo}/releases?per_page=15`,
      { cacheKey: `releases:${repo.owner}/${repo.repo}`, ttlSeconds: CACHE_SECONDS },
    ),
  ]);

  const sinceMs = since ? new Date(since).getTime() : 0;

  const commits =
    commitsRes.kind === 'ok'
      ? (commitsRes.data || [])
          // Only the first line of each message — drop the body noise.
          .map((c) => ({ message: (c.commit?.message || '').split('\n')[0].trim(), date: c.commit?.author?.date || null }))
          .filter((c) => c.message)
      : [];

  const prs =
    pullsRes.kind === 'ok'
      ? (pullsRes.data || [])
          .filter((p) => p.merged_at && (!sinceMs || new Date(p.merged_at).getTime() >= sinceMs))
          .map((p) => ({ title: p.title, mergedAt: p.merged_at }))
      : [];

  const releases =
    releasesRes.kind === 'ok'
      ? (releasesRes.data || [])
          .filter((r) => !r.draft && (!sinceMs || !r.published_at || new Date(r.published_at).getTime() >= sinceMs))
          .map((r) => ({ name: r.name || r.tag_name, publishedAt: r.published_at }))
      : [];

  return { commits, prs, releases };
}

export function activityIsEmpty(a: GitActivity): boolean {
  return a.commits.length === 0 && a.prs.length === 0 && a.releases.length === 0;
}

/**
 * Draft a short progress update from the gathered activity via Grok's
 * structured-output path (same as the AI-review tab). Returns null if the LLM
 * is unconfigured or errors — the caller decides how to degrade.
 */
export async function draftDigest(activity: GitActivity): Promise<{ title: string; body: string } | null> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    logger.warn('[digest] GROK_API_KEY not configured');
    return null;
  }

  const lines: string[] = [];
  if (activity.releases.length) {
    lines.push('Releases:');
    activity.releases.slice(0, 10).forEach((r) => lines.push(`- ${r.name}`));
  }
  if (activity.prs.length) {
    lines.push('Merged pull requests:');
    activity.prs.slice(0, 20).forEach((p) => lines.push(`- ${p.title}`));
  }
  if (activity.commits.length) {
    lines.push('Recent commits:');
    activity.commits.slice(0, 40).forEach((c) => lines.push(`- ${c.message}`));
  }

  const schema = {
    name: 'progress_digest',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'summary'],
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
      },
    },
  };

  const systemPrompt =
    'You write concise build-in-public progress updates for a technical audience. ' +
    'Tone: plain, factual, neutral or first-person-plural ("we shipped…"). No hype, ' +
    'no marketing adjectives, no emojis. Base the update ONLY on the git activity ' +
    'provided — never invent features or numbers. Group related work; lead with the ' +
    'most significant change (a release > a merged PR > stray commits). The "summary" ' +
    'should be 2–4 sentences (max ~600 characters). The "title" is a short headline ' +
    '(≤ 70 characters).';

  const userPrompt = `Here is the recent git activity. Write the progress update.\n\n${lines.join('\n')}`;

  try {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 700,
        response_format: { type: 'json_schema', json_schema: { name: schema.name, schema: schema.schema, strict: true } },
      }),
    });
    if (!res.ok) {
      logger.error('[digest] grok error', { status: res.status } as any);
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { title?: string; summary?: string };
    const title = (parsed.title || '').trim().slice(0, 120);
    const body = (parsed.summary || '').trim().slice(0, 1500);
    if (!body) return null;
    return { title, body };
  } catch (error) {
    logger.error('[digest] draft failed', error as any);
    return null;
  }
}
