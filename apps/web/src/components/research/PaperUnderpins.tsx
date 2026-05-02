'use client';

/**
 * PaperUnderpins
 *
 * Strip rendered on the paper detail page showing every project that
 * visibly cites this paper. Renders nothing when there are no accepted
 * citations.
 *
 * Visual: cosmic-plant card grid with the project's name, token symbol,
 * and current market state. Each card links to /market/[address].
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SkelLine, SkelPaperCard } from './Skeleton';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

interface CitationProject {
  id: string;
  role: 'thesis' | 'foundation' | 'reference';
  status: 'auto' | 'accepted';
  citationNote: string | null;
  sameWallet: boolean;
  createdAt: string;
  project: {
    id: string;
    name: string;
    tokenSymbol: string;
    category: string;
    projectImageUrl: string | null;
    founderWallet: string;
  };
  market: {
    address: string;
    state: number;
    resolution: 'Unresolved' | 'YesWins' | 'NoWins' | 'Refund';
    poolBalance: string;
    targetPool: number;
    expiryTime: string | null;
  } | null;
}

export function PaperUnderpins({ paperId }: { paperId: string }) {
  const [citations, setCitations] = useState<CitationProject[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/research/${paperId}/citations`)
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
  }, [paperId]);

  if (loading) {
    // Quiet placeholder — most papers will have zero citations, so we
    // keep the loading footprint very small to avoid visual churn for
    // the common-case 0-result fetch.
    return (
      <section className="mt-10">
        <div style={{ width: '32%' }}>
          <SkelLine width="100%" />
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SkelPaperCard />
        </div>
      </section>
    );
  }
  if (!citations || citations.length === 0) return null;

  return (
    <section className="mt-10">
      <p
        className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4"
        style={{ color: AMBER }}
      >
        This paper underpins
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {citations.map((c) => (
          <CitationCard key={c.id} citation={c} />
        ))}
      </div>
    </section>
  );
}

function CitationCard({ citation }: { citation: CitationProject }) {
  const { project, market } = citation;
  const { label: stateLabel, color: stateColor } = describeMarket(market);
  const consented =
    !citation.sameWallet && citation.status === 'accepted';

  return (
    <Link
      href={`/market/${market?.address || project.id}`}
      prefetch
      className="block p-4 transition-colors group"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
      }}
    >
      <div className="flex items-start gap-3">
        {project.projectImageUrl && (
          <div
            className="w-12 h-12 flex-shrink-0 overflow-hidden"
            style={{ border: `1px solid ${HAIR_STRONG}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.projectImageUrl}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <p
              className="line-clamp-1"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.05rem',
                fontWeight: 400,
              }}
            >
              {project.name}
            </p>
            <span
              className="mono uppercase tracking-[0.18em] text-[0.55rem]"
              style={{ color: AMBER }}
            >
              ${project.tokenSymbol}
            </span>
          </div>
          <p
            className="mono uppercase tracking-[0.22em] text-[0.5rem]"
            style={{ color: stateColor }}
          >
            {stateLabel}
            {citation.role === 'thesis' && (
              <>
                {' · '}
                <span style={{ color: CREAM_FAINT }}>cited as thesis</span>
              </>
            )}
            {consented && (
              <>
                {' · '}
                <span style={{ color: FOREST }} title="You accepted this citation">
                  ✓ accepted
                </span>
              </>
            )}
          </p>
        </div>
        <ArrowRight
          className="w-4 h-4 mt-1 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: CREAM_FAINT }}
        />
      </div>
      {citation.citationNote && (
        <p
          className="text-sm mt-3 italic"
          style={{
            color: CREAM_DIM,
            fontFamily: 'var(--font-fraunces, serif)',
            borderLeft: `1px solid ${HAIR}`,
            paddingLeft: '0.75rem',
          }}
        >
          {citation.citationNote}
        </p>
      )}
    </Link>
  );
}

function describeMarket(market: CitationProject['market']): {
  label: string;
  color: string;
} {
  if (!market) return { label: 'pending market', color: CREAM_FAINT };
  const { resolution, expiryTime } = market;
  if (resolution === 'YesWins') return { label: 'Bloomed · launched', color: FOREST };
  if (resolution === 'NoWins') return { label: 'Withered · rejected', color: EARTH };
  if (resolution === 'Refund') return { label: 'Returned · refunded', color: CREAM_FAINT };
  if (expiryTime && new Date(expiryTime).getTime() < Date.now()) {
    return { label: 'Closed · pool not met', color: CREAM_FAINT };
  }
  return { label: 'Living · still voting', color: AMBER };
}
