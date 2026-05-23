// Small chip rendered near the top of every whitepaper version. Tells
// the reader which version they're looking at, whether it's current
// or archived, and offers a one-click jump to the version history page.
//
// Design language matches the editorial cosmic-plant system — uppercase
// mono, hairline borders, accent amber on the active dot.

import Link from 'next/link';

interface VersionChipProps {
  version: string;          // e.g. "v2.0"
  state: 'current' | 'archived';
  date: string;             // human-friendly, e.g. "May 2026"
}

const AMBER = '#e89660';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';

export default function VersionChip({ version, state, date }: VersionChipProps) {
  const isCurrent = state === 'current';
  const stateColor = isCurrent ? AMBER : CREAM_FAINT;
  const stateLabel = isCurrent ? 'current' : 'archived';

  return (
    <div
      className="inline-flex items-center gap-3 px-3 py-1.5 mono text-[0.6rem] uppercase tracking-[0.22em]"
      style={{
        color: CREAM_DIM,
        border: `1px solid ${HAIR_STRONG}`,
        background: 'rgba(244,238,228,0.02)',
      }}
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{
          background: stateColor,
          boxShadow: isCurrent ? `0 0 6px ${stateColor}` : 'none',
        }}
      />
      <span style={{ color: CREAM }}>{version}</span>
      <span aria-hidden style={{ color: HAIR_STRONG }}>·</span>
      <span style={{ color: stateColor }}>{stateLabel}</span>
      <span aria-hidden style={{ color: HAIR_STRONG }}>·</span>
      <span>{date}</span>
      <span aria-hidden style={{ color: HAIR_STRONG }}>·</span>
      <Link
        href="/whitepaper/history"
        className="transition-colors hover:text-[#ecb48a]"
        style={{ color: CREAM_DIM }}
      >
        history →
      </Link>
    </div>
  );
}
