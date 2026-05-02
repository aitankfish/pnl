'use client';

/**
 * PaperActivityFeed
 *
 * Vertical timeline of recent commits on the linked GitHub repo. Renders
 * below the README on the paper detail page. Polls every 90 seconds when
 * the tab is foregrounded.
 *
 * Empty / error states are written like editorial copy, not "404 not
 * found"-style placeholders.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { SkelLine, SkelTimelineRow } from './Skeleton';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

const POLL_MS = 90 * 1000;

interface CommitTile {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorAvatarUrl: string | null;
  url: string;
  date: string;
}

interface ActivityPayload {
  repo: string;
  repoUrl: string;
  commits: CommitTile[];
  fetchedAt: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ActivityPayload; freshSha?: string }
  | { kind: 'rate-limited' }
  | { kind: 'gone' }
  | { kind: 'error' };

export function PaperActivityFeed({ paperId }: { paperId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const lastShaRef = useRef<string | null>(null);

  const load = useCallback(
    async (markFresh: boolean) => {
      try {
        const res = await fetch(`/api/research/${paperId}/activity`);
        if (res.status === 502) {
          const json = await res.json().catch(() => ({}));
          if (json?.error?.includes('rate limit')) {
            setState({ kind: 'rate-limited' });
            return;
          }
          setState({ kind: 'error' });
          return;
        }
        if (res.status === 404) {
          setState({ kind: 'gone' });
          return;
        }
        const json = await res.json();
        if (!json?.success) {
          setState({ kind: 'error' });
          return;
        }
        const data = json.data as ActivityPayload;
        const newest = data.commits[0]?.sha;
        const isFresh =
          markFresh &&
          !!newest &&
          !!lastShaRef.current &&
          newest !== lastShaRef.current;
        lastShaRef.current = newest || lastShaRef.current;
        setState({ kind: 'ready', data, freshSha: isFresh ? newest : undefined });
      } catch {
        setState({ kind: 'error' });
      }
    },
    [paperId],
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

  if (state.kind === 'loading') {
    return (
      <section className="mt-12 pnl-fade">
        <p
          className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4"
          style={{ color: AMBER }}
        >
          The pulse
        </p>
        <ul className="relative pl-5">
          <span
            aria-hidden
            className="absolute left-[5px] top-1 bottom-1 pointer-events-none"
            style={{ width: 1, background: HAIR_STRONG }}
          />
          <SkelTimelineRow />
          <SkelTimelineRow />
          <SkelTimelineRow />
        </ul>
      </section>
    );
  }

  if (state.kind === 'gone') {
    return null;
  }

  if (state.kind === 'rate-limited') {
    return (
      <section className="mt-12 pnl-fade">
        <p
          className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4"
          style={{ color: AMBER }}
        >
          The pulse
        </p>
        <p
          className="text-sm italic"
          style={{
            color: CREAM_DIM,
            fontFamily: 'var(--font-fraunces, serif)',
          }}
        >
          We’re seeing too much GitHub traffic right now. The pulse will return shortly.
        </p>
      </section>
    );
  }

  if (state.kind === 'error') {
    return null; // silent — don't clutter the page with system errors
  }

  if (state.data.commits.length === 0) {
    return (
      <section className="mt-12 pnl-fade">
        <p
          className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4"
          style={{ color: AMBER }}
        >
          The pulse
        </p>
        <p
          className="text-sm italic"
          style={{
            color: CREAM_DIM,
            fontFamily: 'var(--font-fraunces, serif)',
          }}
        >
          The repo is quiet. The pulse will start when work lands.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12 pnl-fade">
      <p
        className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4 inline-flex items-center gap-2"
        style={{ color: AMBER }}
      >
        The pulse · github.com/{state.data.repo}
      </p>

      <ul className="relative pl-5">
        {/* Vertical rail */}
        <span
          aria-hidden
          className="absolute left-[5px] top-1 bottom-1 pointer-events-none"
          style={{ width: 1, background: HAIR_STRONG }}
        />
        {state.data.commits.map((c, i) => (
          <CommitRow
            key={c.sha}
            commit={c}
            isFirst={i === 0}
            isFresh={state.freshSha === c.sha}
          />
        ))}
      </ul>
    </section>
  );
}

function CommitRow({
  commit,
  isFirst,
  isFresh,
}: {
  commit: CommitTile;
  isFirst: boolean;
  isFresh: boolean;
}) {
  const accent = isFirst ? AMBER : FOREST;
  return (
    <li className="relative -ml-5 pl-5 py-3 group">
      {/* Dot */}
      <span
        aria-hidden
        className="absolute left-0 top-[1.05rem]"
        style={{
          width: 11,
          height: 11,
          borderRadius: '50%',
          background: accent,
          boxShadow: isFresh
            ? `0 0 0 4px ${accent}33, 0 0 12px ${accent}99`
            : 'none',
          animation: isFresh ? 'pnl-pulse 1.4s ease-out 1' : undefined,
        }}
      />
      <a
        href={commit.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <p
          className="line-clamp-2 mb-1.5"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontSize: '1.02rem',
            lineHeight: 1.4,
          }}
        >
          {commit.message}
        </p>
        <div
          className="flex items-center gap-3 mono uppercase tracking-[0.2em] text-[0.55rem]"
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
        </div>
      </a>
      <style jsx>{`
        @keyframes pnl-pulse {
          0% { box-shadow: 0 0 0 0 ${accent}99; }
          100% { box-shadow: 0 0 0 12px transparent; }
        }
      `}</style>
    </li>
  );
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
