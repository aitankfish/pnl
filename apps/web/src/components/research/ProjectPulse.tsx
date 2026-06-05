'use client';

/**
 * ProjectPulse
 *
 * Step 1 of the agentic-GitHub layer ("Project Pulse"): turns a static bet
 * into a living project by surfacing the git activity PNL already fetches.
 *
 * Resolves the project's repo through its thesis citation
 * (market → cite endpoint → role:'thesis' paper → that paper's githubUrl),
 * then reuses the existing research endpoints to show:
 *   - last-active date + an alive/quiet status
 *   - open PR and open issue counts
 *   - the most recent commits
 *
 * Renders nothing when the project has no thesis paper, no linked repo, or
 * the repo is unreachable — never an empty scaffold. No new infrastructure:
 * every call goes through routes that already exist and cache in Redis.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, GitPullRequest, CircleDot } from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

// Single slow poll — enough for the page to "feel alive" without hammering
// the (already Redis-cached) GitHub routes. Only fires when the tab is shown.
const POLL_MS = 120 * 1000;
// A repo touched within this window reads as actively built ("alive").
const ALIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const COMMITS_SHOWN = 4;

interface CommitTile {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorAvatarUrl: string | null;
  url: string;
  date: string;
}

interface PulseData {
  repo: string;
  repoUrl: string;
  commits: CommitTile[];
  openPulls: number;
  openPullsCapped: boolean;
  openIssues: number;
  openIssuesCapped: boolean;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: PulseData; freshSha?: string }
  | { kind: 'rate-limited' }
  | { kind: 'hidden' }; // no thesis / no repo / error — render nothing

export function ProjectPulse({
  marketIdOrAddress,
}: {
  marketIdOrAddress: string;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const lastShaRef = useRef<string | null>(null);

  const load = useCallback(
    async (markFresh: boolean) => {
      try {
        // 1. Resolve the thesis paper for this project. The repo lives on the
        //    thesis paper's githubUrl — there is no project-direct repo link.
        const citeRes = await fetch(`/api/markets/${marketIdOrAddress}/cite`);
        const citeJson = await citeRes.json().catch(() => null);
        const citations: Array<{ role?: string; paper?: { id?: string } }> =
          citeJson?.success ? citeJson.data?.citations || [] : [];
        const thesis = citations.find((c) => c.role === 'thesis');
        const paperId = thesis?.paper?.id;
        if (!paperId) {
          setState({ kind: 'hidden' });
          return;
        }

        // 2. Pull activity + open PRs + open issues in parallel from the
        //    existing research routes. Activity is the source of truth for
        //    "does this project have a reachable repo at all".
        const [activityRes, pullsRes, issuesRes] = await Promise.all([
          fetch(`/api/research/${paperId}/activity`),
          fetch(`/api/research/${paperId}/repo/pulls?state=open`),
          fetch(`/api/research/${paperId}/repo/issues?state=open`),
        ]);

        if (activityRes.status === 502) {
          const j = await activityRes.json().catch(() => ({}));
          setState(
            j?.error?.includes('rate limit')
              ? { kind: 'rate-limited' }
              : { kind: 'hidden' },
          );
          return;
        }
        if (!activityRes.ok) {
          // 404 (no repo / private / gone) or any error → show nothing.
          setState({ kind: 'hidden' });
          return;
        }
        const activityJson = await activityRes.json();
        if (!activityJson?.success) {
          setState({ kind: 'hidden' });
          return;
        }

        const pullsJson = pullsRes.ok
          ? await pullsRes.json().catch(() => null)
          : null;
        const issuesJson = issuesRes.ok
          ? await issuesRes.json().catch(() => null)
          : null;
        const pulls: unknown[] = pullsJson?.success
          ? pullsJson.data?.pulls || []
          : [];
        const issues: unknown[] = issuesJson?.success
          ? issuesJson.data?.issues || []
          : [];

        const commits: CommitTile[] = activityJson.data?.commits || [];
        const data: PulseData = {
          repo: activityJson.data.repo,
          repoUrl: activityJson.data.repoUrl,
          commits,
          // The list endpoints page at 30; treat a full page as "30+".
          openPulls: pulls.length,
          openPullsCapped: pulls.length >= 30,
          openIssues: issues.length,
          openIssuesCapped: issues.length >= 30,
        };

        const newest = commits[0]?.sha;
        const isFresh =
          markFresh &&
          !!newest &&
          !!lastShaRef.current &&
          newest !== lastShaRef.current;
        lastShaRef.current = newest || lastShaRef.current;

        setState({
          kind: 'ready',
          data,
          freshSha: isFresh ? newest : undefined,
        });
      } catch {
        setState({ kind: 'hidden' });
      }
    },
    [marketIdOrAddress],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load(true);
      }
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  if (state.kind === 'hidden') return null;

  if (state.kind === 'loading') {
    return (
      <section className="mb-8 pnl-fade">
        <PulseLabel repo={null} alive={false} />
        <div
          className="mt-2"
          style={{
            border: `1px solid ${HAIR_STRONG}`,
            background: 'rgba(244,238,228,0.02)',
            height: '8.5rem',
          }}
        />
      </section>
    );
  }

  if (state.kind === 'rate-limited') {
    return (
      <section className="mb-8 pnl-fade">
        <PulseLabel repo={null} alive={false} />
        <p
          className="mt-2 text-sm italic"
          style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}
        >
          We’re seeing too much GitHub traffic right now. The pulse will return
          shortly.
        </p>
      </section>
    );
  }

  const { data, freshSha } = state;
  const lastDate = data.commits[0]?.date;
  const alive = lastDate
    ? Date.now() - new Date(lastDate).getTime() < ALIVE_WINDOW_MS
    : false;

  return (
    <section className="mb-8 pnl-fade">
      <PulseLabel repo={data.repo} alive={alive} />

      <div
        className="mt-2"
        style={{
          border: `1px solid ${HAIR_STRONG}`,
          background: 'rgba(244,238,228,0.02)',
        }}
      >
        {/* Stat row — the at-a-glance "is this alive" signal. */}
        <div
          className="flex items-center flex-wrap gap-x-6 gap-y-2 px-4 py-3"
          style={{ borderBottom: `1px solid ${HAIR}` }}
        >
          <Stat
            label={alive ? 'active' : 'last touched'}
            value={lastDate ? relativeTime(lastDate) : '—'}
            tone={alive ? FOREST : CREAM_DIM}
          />
          <Stat
            icon={<GitPullRequest className="w-3 h-3" />}
            label="open prs"
            value={countLabel(data.openPulls, data.openPullsCapped)}
            tone={data.openPulls > 0 ? AMBER : CREAM_FAINT}
          />
          <Stat
            icon={<CircleDot className="w-3 h-3" />}
            label="open issues"
            value={countLabel(data.openIssues, data.openIssuesCapped)}
            tone={data.openIssues > 0 ? AMBER : CREAM_FAINT}
          />
        </div>

        {/* Recent commits — the heartbeat itself. */}
        {data.commits.length > 0 ? (
          <ul>
            {data.commits.slice(0, COMMITS_SHOWN).map((c, i) => (
              <CommitRow
                key={c.sha}
                commit={c}
                isFirst={i === 0}
                isFresh={freshSha === c.sha}
                isLast={
                  i === Math.min(COMMITS_SHOWN, data.commits.length) - 1
                }
              />
            ))}
          </ul>
        ) : (
          <p
            className="px-4 py-4 text-sm italic"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
            }}
          >
            The repo is linked but quiet. The pulse starts when work lands.
          </p>
        )}

        <a
          href={data.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-3 mono uppercase tracking-[0.24em] text-[0.55rem] transition-colors"
          style={{ color: FOREST, borderTop: `1px solid ${HAIR}` }}
          onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
          onMouseLeave={(e) => (e.currentTarget.style.color = FOREST)}
        >
          view repository
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </section>
  );
}

function PulseLabel({
  repo,
  alive,
}: {
  repo: string | null;
  alive: boolean;
}) {
  return (
    <p
      className="mono uppercase tracking-[0.32em] text-[0.6rem] inline-flex items-center gap-2"
      style={{ color: AMBER }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: alive ? FOREST : CREAM_FAINT,
          boxShadow: alive ? `0 0 8px ${FOREST}` : 'none',
        }}
      />
      Project pulse
      {repo && (
        <span style={{ color: CREAM_FAINT }} className="normal-case tracking-normal">
          · github.com/{repo}
        </span>
      )}
    </p>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="mono uppercase tracking-[0.22em] text-[0.5rem] inline-flex items-center gap-1.5"
        style={{ color: CREAM_FAINT }}
      >
        {icon}
        {label}
      </span>
      <span
        className="mono text-[0.8rem]"
        style={{ color: tone, fontFeatureSettings: '"tnum"' }}
      >
        {value}
      </span>
    </div>
  );
}

function CommitRow({
  commit,
  isFirst,
  isFresh,
  isLast,
}: {
  commit: CommitTile;
  isFirst: boolean;
  isFresh: boolean;
  isLast: boolean;
}) {
  const accent = isFirst ? AMBER : FOREST;
  return (
    <li
      className="group"
      style={{ borderBottom: isLast ? 'none' : `1px solid ${HAIR}` }}
    >
      <a
        href={commit.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 px-4 py-2.5"
      >
        <span
          aria-hidden
          className="mt-[0.4rem] shrink-0"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: accent,
            boxShadow: isFresh ? `0 0 0 3px ${accent}33, 0 0 10px ${accent}99` : 'none',
          }}
        />
        <span className="min-w-0 flex-1">
          <span
            className="block line-clamp-1"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '0.92rem',
              lineHeight: 1.35,
            }}
          >
            {commit.message}
          </span>
          <span
            className="flex items-center gap-2 mono uppercase tracking-[0.18em] text-[0.5rem] mt-1"
            style={{ color: CREAM_FAINT }}
          >
            <span>{commit.authorName}</span>
            <span>·</span>
            <span>{relativeTime(commit.date)}</span>
            <span>·</span>
            <span style={{ color: AMBER }} className="inline-flex items-center gap-1">
              #{commit.shortSha}
              <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </span>
        </span>
      </a>
    </li>
  );
}

function countLabel(n: number, capped: boolean): string {
  if (n === 0) return '0';
  return capped ? `${n}+` : String(n);
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!isFinite(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
