'use client';

/**
 * MarketCitations
 *
 * Renders the research papers cited by a project. Splits into "The thesis"
 * (the primary paper, role === 'thesis') and "Foundations" (everything else).
 * Returns null if no visible citations exist — never renders an empty
 * scaffold, since a market without any cited research should show no
 * scaffolding at all.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ScrollText } from 'lucide-react';
import { SkelBlock, SkelLine } from './Skeleton';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

const PAPER_BG = '#fbfaf6';
const INK = '#0d0d0d';
const INK_DIM = 'rgba(13,13,13,0.62)';
const INK_FAINT = 'rgba(13,13,13,0.35)';

interface Citation {
  id: string;
  paperId: string;
  role: 'thesis' | 'foundation' | 'reference';
  status: 'auto' | 'accepted';
  citationNote: string | null;
  sameWallet: boolean;
  paper: {
    id: string;
    title: string;
    authorName: string;
    authorWallet: string;
    authorXHandle: string | null;
    summary: string | null;
    paperUrl: string;
    currentVersion: number;
    likeCount: number;
    dislikeCount: number;
  };
}

export function MarketCitations({
  marketIdOrAddress,
}: {
  marketIdOrAddress: string;
}) {
  const [citations, setCitations] = useState<Citation[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/markets/${marketIdOrAddress}/cite`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success) {
          setCitations(json.data?.citations || []);
        } else {
          setCitations([]);
        }
      })
      .catch(() => {
        if (!cancelled) setCitations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [marketIdOrAddress]);

  if (loading) {
    // Single thesis-shaped block as a soft placeholder. We don't render
    // any roles/labels here because if the project has no citations,
    // the entire section vanishes — better to show a quiet block during
    // the fetch than reserve space with text that may never resolve.
    return (
      <div className="mb-6">
        <div className="mb-3" style={{ width: '40%' }}>
          <SkelLine width="100%" />
        </div>
        <SkelBlock height="9rem" />
      </div>
    );
  }

  if (!citations || citations.length === 0) return null;

  const thesis = citations.find((c) => c.role === 'thesis');
  const foundations = citations.filter((c) => c.role === 'foundation');
  const references = citations.filter((c) => c.role === 'reference');

  return (
    <section className="mb-8">
      <p
        className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3 inline-flex items-center gap-2"
        style={{ color: AMBER }}
      >
        <ScrollText className="w-3.5 h-3.5" />
        Built on the paper
      </p>

      {thesis && <ThesisCard citation={thesis} />}

      {(foundations.length > 0 || references.length > 0) && (
        <div className="mt-3">
          {foundations.length > 0 && (
            <>
              <p
                className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-2 mt-4"
                style={{ color: CREAM_FAINT }}
              >
                Foundations
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {foundations.map((c) => (
                  <SecondaryCitationCard key={c.id} citation={c} />
                ))}
              </div>
            </>
          )}
          {references.length > 0 && (
            <>
              <p
                className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-2 mt-4"
                style={{ color: CREAM_FAINT }}
              >
                References
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {references.map((c) => (
                  <SecondaryCitationCard key={c.id} citation={c} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ThesisCard({ citation }: { citation: Citation }) {
  const { paper } = citation;
  const consented = !citation.sameWallet && citation.status === 'accepted';
  return (
    <Link
      href={`/research/${paper.id}`}
      prefetch
      className="block transition-transform group"
      style={{
        background: PAPER_BG,
        color: INK,
        borderLeft: `2px solid ${INK}`,
        padding: '1.25rem 1.5rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      }}
    >
      <p
        className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-2 inline-flex items-center gap-2"
        style={{ color: INK_FAINT }}
      >
        The thesis · v{paper.currentVersion}
        {consented && (
          <span
            className="mono uppercase tracking-[0.18em] text-[0.5rem]"
            style={{ color: FOREST }}
            title="Cited author has accepted this citation"
          >
            ✓ cited with permission
          </span>
        )}
      </p>
      <h3
        className="line-clamp-2 mb-2"
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.4rem',
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: '-0.005em',
        }}
      >
        {paper.title}
      </h3>
      <p
        className="mb-3 text-sm"
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          color: INK_DIM,
        }}
      >
        by <span style={{ color: INK }}>{paper.authorName}</span>
        {paper.authorXHandle && (
          <span style={{ color: FOREST }}> · @{paper.authorXHandle}</span>
        )}
      </p>
      {paper.summary && (
        <p
          className="text-sm line-clamp-3 mb-4"
          style={{
            fontFamily: 'var(--font-fraunces, serif)',
            color: INK_DIM,
            lineHeight: 1.5,
          }}
        >
          {paper.summary}
        </p>
      )}
      {citation.citationNote && (
        <p
          className="text-sm mb-4 italic"
          style={{
            fontFamily: 'var(--font-fraunces, serif)',
            color: INK_DIM,
            borderLeft: `2px solid rgba(13,13,13,0.18)`,
            paddingLeft: '0.75rem',
          }}
        >
          {citation.citationNote}
        </p>
      )}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: `1px solid rgba(13,13,13,0.08)` }}
      >
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5" style={{ color: FOREST }}>
            ✓
            <span className="mono text-[0.7rem]" style={{ fontFeatureSettings: '"tnum"' }}>
              {paper.likeCount}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ color: EARTH }}>
            ✗
            <span className="mono text-[0.7rem]" style={{ fontFeatureSettings: '"tnum"' }}>
              {paper.dislikeCount}
            </span>
          </span>
        </div>
        <span
          className="mono uppercase tracking-[0.24em] text-[0.6rem] inline-flex items-center gap-1.5"
          style={{ color: FOREST }}
        >
          read the paper
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}

function SecondaryCitationCard({ citation }: { citation: Citation }) {
  const { paper } = citation;
  const consented = !citation.sameWallet && citation.status === 'accepted';
  return (
    <Link
      href={`/research/${paper.id}`}
      prefetch
      className="block transition-colors"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
        padding: '0.85rem 1rem',
      }}
    >
      <p
        className="line-clamp-2 mb-1"
        style={{
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '0.95rem',
          fontWeight: 400,
          lineHeight: 1.2,
        }}
      >
        {paper.title}
      </p>
      <p
        className="mono uppercase tracking-[0.22em] text-[0.5rem]"
        style={{ color: CREAM_FAINT }}
      >
        {paper.authorName} · v{paper.currentVersion}
        {consented && (
          <>
            {' '}·{' '}
            <span style={{ color: FOREST }} title="Cited with permission">
              ✓
            </span>
          </>
        )}
      </p>
    </Link>
  );
}
