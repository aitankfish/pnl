/**
 * Milestone settlement — the git-as-oracle resolver, off-chain edition.
 *
 * PNL does not judge whether a milestone's work is good. It reads an objective
 * git signal the founder controls (a release/tag they cut) and flips the
 * milestone's DISPLAY status. The on-chain stake is untouched — settling the
 * real money is the audit-gated, chain-adjacent step deferred per the
 * agentic-github design doc.
 *
 * Settlement is lazy (runs when milestones are listed). That is fine precisely
 * because nothing here moves money; when this ever settles real stake it must
 * move to a trusted cron, not on-read.
 */

import { Milestone, PaperCitation, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl, type RepoIdent } from '@/lib/github';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const RELEASES_CACHE_SECONDS = 5 * 60;

interface GhRelease {
  name: string | null;
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
}

interface GhTag {
  name: string;
  commit: { sha: string };
}

/**
 * Resolve a project's repo through its thesis citation. There is no
 * project-direct repo link — the repo lives on the cited thesis paper's
 * `githubUrl`. Returns null when there's no visible thesis paper or no repo.
 */
export async function resolveThesisRepo(projectId: string): Promise<RepoIdent | null> {
  const thesis = await PaperCitation.findOne({
    projectId,
    role: 'thesis',
    status: { $in: ['auto', 'accepted'] },
  })
    .sort({ createdAt: 1 })
    .lean<any>();
  if (!thesis) return null;

  const paper = await ResearchPaper.findById(thesis.paperId).select('githubUrl status').lean<any>();
  if (!paper || paper.status !== 'active' || !paper.githubUrl) return null;

  return parseRepoFromUrl(paper.githubUrl);
}

/**
 * Fetch the repo's releases and tags (cached). Returns lowercased name sets
 * plus a lookup from a matched name → its evidence URL + timestamp.
 */
async function fetchGitSignals(repo: RepoIdent) {
  const evidence = new Map<string, { url: string; at: string | null }>();

  const releasesRes = await ghCachedFetch<GhRelease[]>(
    `/repos/${repo.owner}/${repo.repo}/releases?per_page=50`,
    { cacheKey: `releases:${repo.owner}/${repo.repo}`, ttlSeconds: RELEASES_CACHE_SECONDS },
  );
  if (releasesRes.kind === 'ok') {
    for (const r of releasesRes.data || []) {
      if (r.draft) continue;
      const url = r.html_url;
      const at = r.published_at;
      for (const key of [r.tag_name, r.name].filter(Boolean) as string[]) {
        evidence.set(key.toLowerCase().trim(), { url, at });
      }
    }
  }

  const tagsRes = await ghCachedFetch<GhTag[]>(
    `/repos/${repo.owner}/${repo.repo}/tags?per_page=100`,
    { cacheKey: `tags:${repo.owner}/${repo.repo}`, ttlSeconds: RELEASES_CACHE_SECONDS },
  );
  if (tagsRes.kind === 'ok') {
    for (const t of tagsRes.data || []) {
      const key = t.name.toLowerCase().trim();
      // A release for the same tag is richer evidence — don't overwrite it.
      if (!evidence.has(key)) {
        evidence.set(key, { url: `https://github.com/${repo.owner}/${repo.repo}/releases/tag/${t.name}`, at: null });
      }
    }
  }

  return evidence;
}

/**
 * Run lazy settlement over a project's milestones and persist any transitions.
 * Returns the up-to-date milestone docs (plain objects).
 *
 * - A git-triggered ('release'|'tag') open milestone whose `triggerMatch`
 *   appears in the repo's signals → 'shipped' (with the evidence URL).
 * - Any open milestone past its `targetDate` with no matching signal → 'missed'.
 * - 'manual' milestones only ship via the founder's PATCH; they can still miss.
 * Shipped/missed milestones are frozen and never re-evaluated.
 */
export async function settleMilestones(marketAddress: string, projectId?: string): Promise<any[]> {
  const milestones = await Milestone.find({ marketAddress }).sort({ order: 1, targetDate: 1 });
  if (milestones.length === 0) return [];

  const open = milestones.filter((m) => m.status === 'open');
  if (open.length === 0) return milestones.map((m) => m.toObject());

  const now = Date.now();
  const needsGit = open.some((m) => (m.triggerType === 'release' || m.triggerType === 'tag') && m.triggerMatch);

  let signals: Map<string, { url: string; at: string | null }> | null = null;
  if (needsGit && projectId) {
    try {
      const repo = await resolveThesisRepo(projectId);
      if (repo) signals = await fetchGitSignals(repo);
    } catch (e) {
      // A git hiccup must not block listing — deadlines still settle.
      logger.warn('[milestones] git signal fetch failed', { marketAddress } as any);
    }
  }

  const dirty: any[] = [];
  for (const m of open) {
    let matched: { url: string; at: string | null } | undefined;
    if (signals && m.triggerMatch && (m.triggerType === 'release' || m.triggerType === 'tag')) {
      matched = signals.get(m.triggerMatch.toLowerCase().trim());
    }

    if (matched) {
      m.status = 'shipped';
      m.evidenceUrl = matched.url;
      m.shippedAt = matched.at ? new Date(matched.at) : new Date();
      m.updatedAt = new Date();
      dirty.push(m);
    } else if (new Date(m.targetDate).getTime() < now) {
      m.status = 'missed';
      m.updatedAt = new Date();
      dirty.push(m);
    }
  }

  if (dirty.length) {
    await Promise.all(dirty.map((m) => m.save()));
    logger.info('[milestones] settled', { marketAddress, transitions: dirty.length } as any);
  }

  return milestones.map((m) => m.toObject());
}

export function serializeMilestone(m: any) {
  return {
    id: String(m._id),
    title: m.title,
    detail: m.detail || null,
    targetDate: m.targetDate,
    triggerType: m.triggerType,
    triggerMatch: m.triggerMatch || null,
    status: m.status,
    evidenceUrl: m.evidenceUrl || null,
    shippedAt: m.shippedAt || null,
    order: m.order ?? 0,
    createdAt: m.createdAt,
  };
}
