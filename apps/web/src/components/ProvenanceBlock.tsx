'use client';

import { useState } from 'react';

// ─── ProvenanceBlock ─────────────────────────────────────────────
//
// Editorial chip displayed on the market detail page for markets
// that were drafted by an agent (Claude Code / Cursor / Cline /
// Codex / etc.) via MCP and the founder opted in to sharing the
// originating context.
//
// Renders nothing for markets without provenance — most markets.
//
// Visual: an amber-toned bordered card, manifesto-tone serif label,
// the conversation excerpt in italic, and optional code snippet in a
// monospace block. Reads like a found document in the field guide,
// not a JSON dump.

export interface Provenance {
  source?: string;          // 'claude-code' | 'cursor' | 'cline' | 'codex' | 'other'
  excerpt?: string;
  codeSnippet?: string;
  timestamp?: string;       // ISO 8601
}

const SOURCE_LABEL: Record<string, string> = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  cline: 'Cline',
  codex: 'Codex',
  other: 'an agent',
};

function formatTimestamp(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // "May 22, 2026" — editorial register, no time precision needed
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ProvenanceBlock({
  provenance,
  createdVia,
}: {
  provenance?: Provenance | null;
  createdVia?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Cosmic-plant palette pulled from the broader app
  const AMBER = '#e89660';
  const CREAM = '#f4eee4';
  const MUTED = '#c8bdb0';
  const HAIR = 'rgba(232,150,96,0.22)';

  const hasNarrative = !!provenance && (!!provenance.excerpt || !!provenance.codeSnippet);

  // No shared conversation/code context. Still surface a minimal origin chip
  // for terminal-born markets so every MCP-created idea shows where it came
  // from; web/mobile markets render nothing.
  if (!hasNarrative) {
    if (createdVia === 'mcp') {
      return (
        <div
          className="mono uppercase my-4 inline-flex items-center"
          style={{
            color: AMBER,
            fontSize: '0.6rem',
            letterSpacing: '0.22em',
            background: 'linear-gradient(135deg, rgba(232,150,96,0.06) 0%, rgba(232,150,96,0.02) 100%)',
            border: `1px solid ${HAIR}`,
            borderLeft: `3px solid ${AMBER}`,
            padding: '0.4rem 0.7rem',
          }}
          aria-label="Origin of this idea"
        >
          Born in the terminal
        </div>
      );
    }
    return null;
  }

  const sourceLabel = provenance!.source ? (SOURCE_LABEL[provenance!.source] ?? provenance!.source) : 'an agent';
  const dateLabel = formatTimestamp(provenance!.timestamp);
  const hasExtra = (provenance!.excerpt && provenance!.excerpt.length > 140) || provenance!.codeSnippet;
  const shouldExpand = expanded || !hasExtra;

  const fullExcerpt = (provenance!.excerpt || '').trim();
  const preview = fullExcerpt.length > 140 ? fullExcerpt.slice(0, 140).trim() + '…' : fullExcerpt;

  return (
    <aside
      className="my-4 px-4 py-3 sm:px-5 sm:py-4"
      style={{
        background: 'linear-gradient(135deg, rgba(232,150,96,0.06) 0%, rgba(232,150,96,0.02) 100%)',
        border: `1px solid ${HAIR}`,
        borderLeft: `3px solid ${AMBER}`,
      }}
      aria-label="Origin of this idea"
    >
      <div
        className="mono uppercase"
        style={{
          color: AMBER,
          fontSize: '0.6rem',
          letterSpacing: '0.22em',
          marginBottom: '0.4rem',
        }}
      >
        Born in {sourceLabel}{dateLabel ? ` · ${dateLabel}` : ''}
      </div>

      {fullExcerpt && (
        <blockquote
          className="serif italic"
          style={{
            color: CREAM,
            fontSize: '0.95rem',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          &ldquo;{shouldExpand ? fullExcerpt : preview}&rdquo;
        </blockquote>
      )}

      {shouldExpand && provenance!.codeSnippet && (
        <pre
          className="mono mt-3 overflow-x-auto"
          style={{
            background: 'rgba(10,8,20,0.5)',
            border: `1px solid ${HAIR}`,
            padding: '0.7rem 0.9rem',
            fontSize: '0.78rem',
            color: MUTED,
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          <code>{provenance!.codeSnippet!.trim()}</code>
        </pre>
      )}

      {hasExtra && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mono uppercase mt-3"
          style={{
            color: AMBER,
            fontSize: '0.6rem',
            letterSpacing: '0.22em',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {expanded ? '— Hide context' : '+ Show full context'}
        </button>
      )}
    </aside>
  );
}
