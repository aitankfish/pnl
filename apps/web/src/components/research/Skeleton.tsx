'use client';

/**
 * Lightweight skeleton primitives shared across the research surface.
 * Match the existing `skel()` aesthetic in MarketDetailClient — same
 * pulse animation, same hairline border, same cream-on-cosmic palette.
 */

import React from 'react';

const PULSE_BG = 'rgba(244,238,228,0.025)';
const PULSE_BORDER = 'rgba(244,238,228,0.08)';

export function SkelBlock({
  height,
  className = '',
  borderless = false,
}: {
  height: string;
  className?: string;
  borderless?: boolean;
}) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        height,
        background: PULSE_BG,
        border: borderless ? 'none' : `1px solid ${PULSE_BORDER}`,
      }}
    />
  );
}

export function SkelLine({
  width = '100%',
  className = '',
}: {
  width?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block animate-pulse ${className}`}
      style={{
        width,
        height: '0.65rem',
        background: PULSE_BG,
        borderRadius: 1,
      }}
    />
  );
}

/**
 * Vertical-timeline skeleton row used in PaperActivityFeed while commits
 * load. Matches the dot + message + meta-line shape of CommitRow.
 */
export function SkelTimelineRow() {
  return (
    <li className="relative -ml-5 pl-5 py-3 flex flex-col gap-1.5">
      <span
        aria-hidden
        className="absolute left-0 top-[1.05rem] animate-pulse"
        style={{
          width: 11,
          height: 11,
          borderRadius: '50%',
          background: PULSE_BG,
          border: `1px solid ${PULSE_BORDER}`,
        }}
      />
      <SkelLine width="78%" />
      <SkelLine width="42%" />
    </li>
  );
}

/**
 * Paper-card skeleton — used for PaperUnderpins / MarketCitations cards.
 */
export function SkelPaperCard() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: PULSE_BG,
        border: `1px solid ${PULSE_BORDER}`,
        padding: '1rem',
      }}
    >
      <SkelLine width="40%" />
      <div className="mt-2.5">
        <SkelLine width="92%" />
      </div>
      <div className="mt-1.5">
        <SkelLine width="65%" />
      </div>
      <div className="mt-3">
        <SkelLine width="30%" />
      </div>
    </div>
  );
}
