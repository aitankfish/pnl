/**
 * Shared research-paper card.
 *
 * Extracted from the author page's local PaperCard so the same surface renders
 * identically on the author page, the wallet Portfolio "Papers" tab, and the
 * public profile research section. Presentational only (no hooks) — safe in
 * both server and client components.
 */

import Link from 'next/link';

// Paper-card palette (kept in sync with the cosmic-plant theme).
const PAPER_BG = '#fbfaf6';
const INK = '#0d0d0d';
const INK_DIM = 'rgba(13,13,13,0.62)';
const INK_FAINT = 'rgba(13,13,13,0.35)';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

export interface ResearchPaperCardData {
  id: string;
  title: string;
  summary?: string | null;
  likeCount?: number;
  dislikeCount?: number;
  createdAt: string | Date;
}

export function ResearchPaperCard({ paper }: { paper: ResearchPaperCardData }) {
  const dateLabel = new Date(paper.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <Link
      href={`/research/${paper.id}`}
      prefetch
      className="block transition-transform"
      style={{
        background: PAPER_BG,
        color: INK,
        borderLeft: `2px solid ${INK}`,
        padding: '1.25rem 1.25rem 1rem',
        minHeight: 200,
      }}
    >
      <p
        className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-3"
        style={{ color: INK_FAINT }}
      >
        Research · {dateLabel}
      </p>
      <h3
        className="line-clamp-3 mb-2"
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.2rem',
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: '-0.005em',
        }}
      >
        {paper.title}
      </h3>
      {paper.summary && (
        <p
          className="text-sm line-clamp-2 mb-4"
          style={{
            fontFamily: 'var(--font-fraunces, serif)',
            color: INK_DIM,
            lineHeight: 1.4,
          }}
        >
          {paper.summary}
        </p>
      )}
      <div
        className="flex items-center gap-4 mt-auto pt-3"
        style={{ borderTop: `1px solid rgba(13,13,13,0.08)` }}
      >
        <span className="inline-flex items-center gap-1.5" style={{ color: FOREST }}>
          ✓
          <span className="mono text-[0.7rem]" style={{ fontFeatureSettings: '"tnum"' }}>
            {paper.likeCount || 0}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: EARTH }}>
          ✗
          <span className="mono text-[0.7rem]" style={{ fontFeatureSettings: '"tnum"' }}>
            {paper.dislikeCount || 0}
          </span>
        </span>
      </div>
    </Link>
  );
}
