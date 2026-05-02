'use client';

/**
 * Research paper grid for /browse.
 *
 * Cards adopt a paper aesthetic (cream background, black ink) to signal that
 * this is a different kind of object than the cosmic-plant market cards. Click
 * to read the paper at /research/[id].
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, X } from 'lucide-react';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const EARTH = '#d67347';

const PAPER_BG = '#fbfaf6';
const INK = '#0d0d0d';
const INK_DIM = 'rgba(13,13,13,0.62)';
const INK_FAINT = 'rgba(13,13,13,0.35)';
const FOREST = '#3f7a42';
const REJECT = '#b04a26';

interface PaperCard {
  id: string;
  title: string;
  authorName: string;
  authorXHandle: string | null;
  paperUrl: string;
  summary: string | null;
  githubUrl: string | null;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
}

export function ResearchGrid({
  citedPaperIds,
  filter = 'all',
}: {
  citedPaperIds?: Set<string>;
  filter?: 'all' | 'code' | 'cited';
}) {
  const [papers, setPapers] = useState<PaperCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/research/list?limit=24')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Failed');
        setPapers(json.data?.papers || []);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('[research/list] failed', err);
        setError('Could not load papers.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        style={{ color: CREAM_DIM }}
      >
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: AMBER }} />
        <span className="ml-3 mono text-[0.62rem] uppercase tracking-[0.24em]">
          Gathering the papers…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="text-center py-12"
        style={{ background: 'rgba(214,115,71,0.06)', border: `1px solid ${EARTH}55` }}
      >
        <p
          className="mb-4"
          style={{ color: EARTH, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1rem' }}
        >
          {error}
        </p>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div
        className="text-center py-16 px-6"
        style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
      >
        <h3
          className="mb-2"
          style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.4rem' }}
        >
          No papers yet.
        </h3>
        <p
          className="mono uppercase tracking-[0.22em] text-[0.6rem] mb-6"
          style={{ color: CREAM_FAINT }}
        >
          Be the first to publish one.
        </p>
        <Link
          href="/create"
          className="mono uppercase tracking-[0.24em] text-[0.6rem] px-4 py-2 inline-block transition-colors"
          style={{ background: AMBER, color: '#0a0814' }}
        >
          Publish a paper
        </Link>
      </div>
    );
  }

  // Editorial picks — env-driven hand-curated IDs, comma-separated. We
  // resolve to actual paper objects from the loaded list rather than a
  // separate fetch; missing IDs just don't render.
  const editorialIdsRaw =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_EDITORIAL_PAPER_IDS
      : '';
  const editorialIds = (editorialIdsRaw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const editorialPicks = editorialIds
    .map((id) => papers.find((p) => p.id === id))
    .filter(Boolean) as PaperCard[];
  const editorialIdSet = new Set(editorialPicks.map((p) => p.id));

  const visiblePapers = papers.filter((p) => {
    if (filter === 'code') return !!p.githubUrl;
    if (filter === 'cited') return !!citedPaperIds?.has(p.id);
    // When showing 'all', drop the picks from the regular grid so they
    // appear once (in the shelf, not duplicated below).
    if (filter === 'all' && editorialIdSet.has(p.id)) return false;
    return true;
  });

  if (visiblePapers.length === 0) {
    return (
      <div
        className="text-center py-16 px-6"
        style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
      >
        <h3
          className="mb-2"
          style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.4rem' }}
        >
          No papers match that filter.
        </h3>
        <p
          className="mono uppercase tracking-[0.22em] text-[0.6rem]"
          style={{ color: CREAM_FAINT }}
        >
          try a different chip, or browse all
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Editorial shelf — only shown on the unfiltered "all" view. */}
      {filter === 'all' && editorialPicks.length > 0 && (
        <section className="mb-10">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
            style={{ color: AMBER }}
          >
            Editor’s shelf
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editorialPicks.map((p) => (
              <PaperCardItem
                key={p.id}
                paper={p}
                isCited={!!citedPaperIds?.has(p.id)}
                featured
              />
            ))}
          </div>
        </section>
      )}

      <p
        className="mono uppercase tracking-[0.24em] text-[0.6rem] mb-4"
        style={{ color: CREAM_DIM }}
      >
        {visiblePapers.length} paper{visiblePapers.length === 1 ? '' : 's'}
        {filter !== 'all' ? ` (filtered)` : ' on the shelf'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visiblePapers.map((p) => (
          <PaperCardItem
            key={p.id}
            paper={p}
            isCited={!!citedPaperIds?.has(p.id)}
          />
        ))}
      </div>
    </>
  );
}

function PaperCardItem({
  paper,
  isCited,
  featured = false,
}: {
  paper: PaperCard;
  isCited: boolean;
  featured?: boolean;
}) {
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
        borderLeft: `${featured ? 4 : 2}px solid ${featured ? AMBER : INK}`,
        padding: featured ? '1.5rem 1.5rem 1.25rem' : '1.25rem 1.25rem 1rem',
        minHeight: featured ? 260 : 220,
        boxShadow: featured ? '0 14px 32px rgba(0,0,0,0.35)' : undefined,
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p
          className="mono uppercase tracking-[0.28em] text-[0.55rem]"
          style={{ color: featured ? '#a35a20' : INK_FAINT }}
        >
          {featured ? 'Editor’s pick · ' : 'Research · '}
          {dateLabel}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {paper.githubUrl && (
            <span
              className="mono uppercase tracking-[0.18em] text-[0.5rem] px-1.5 py-0.5 inline-flex items-center gap-1"
              style={{ color: FOREST, border: `1px solid ${FOREST}55` }}
              title="Code repository linked"
            >
              🐙 code
            </span>
          )}
          {isCited && (
            <span
              className="mono uppercase tracking-[0.18em] text-[0.5rem] px-1.5 py-0.5"
              style={{
                color: '#0d0d0d',
                background: 'rgba(232,150,96,0.55)',
              }}
              title="Underpins a project on PNL"
            >
              ✎ cited
            </span>
          )}
        </div>
      </div>
      <h3
        className="line-clamp-3 mb-2"
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.25rem',
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: '-0.005em',
        }}
      >
        {paper.title}
      </h3>
      <p
        className="text-sm mb-4"
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          color: INK_DIM,
        }}
      >
        by <span style={{ color: INK }}>{paper.authorName}</span>
        {paper.authorXHandle && (
          <>
            {' '}· <span style={{ color: FOREST }}>@{paper.authorXHandle}</span>
          </>
        )}
      </p>
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
          <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
          <span
            className="mono text-[0.7rem]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {paper.likeCount}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: REJECT }}>
          <X className="w-3.5 h-3.5" strokeWidth={2.25} />
          <span
            className="mono text-[0.7rem]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {paper.dislikeCount}
          </span>
        </span>
      </div>
    </Link>
  );
}
