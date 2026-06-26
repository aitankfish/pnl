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

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ScrollText, Plus, X, Loader2 } from 'lucide-react';
import { SkelBlock, SkelLine } from './Skeleton';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { PaperSearchAutocomplete, type PaperSearchResult } from './PaperSearchAutocomplete';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

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
    paperUrl: string | null;
    doi: string | null;
    externalUrl: string | null;
    currentVersion: number;
    likeCount: number;
    dislikeCount: number;
  };
}

export function MarketCitations({
  marketIdOrAddress,
  isFounder = false,
}: {
  marketIdOrAddress: string;
  // When the viewer is the project's founder we surface an inline control to
  // link more papers to the market — the cite endpoint already accepts
  // post-launch citations from the founder, this is just the missing UI.
  isFounder?: boolean;
}) {
  const [citations, setCitations] = useState<Citation[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-fetch after a founder links a new paper (no cancellation needed — it's
  // a deliberate user action, not a mount-time race).
  const reload = useCallback(() => {
    fetch(`/api/markets/${marketIdOrAddress}/cite`)
      .then((r) => r.json())
      .then((json) => setCitations(json?.success ? json.data?.citations || [] : []))
      .catch(() => {});
  }, [marketIdOrAddress]);

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

  if (!citations || citations.length === 0) {
    // No citations: a visitor sees nothing; the founder sees an invitation to
    // link the research behind the project.
    if (!isFounder) return null;
    return (
      <section className="mb-8">
        <p
          className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3 inline-flex items-center gap-2"
          style={{ color: AMBER }}
        >
          <ScrollText className="w-3.5 h-3.5" />
          Built on the paper
        </p>
        <AddPaperPanel
          marketIdOrAddress={marketIdOrAddress}
          existingIds={[]}
          hasThesis={false}
          onAdded={reload}
        />
      </section>
    );
  }

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

      {isFounder && (
        <div className="mt-4">
          <AddPaperPanel
            marketIdOrAddress={marketIdOrAddress}
            existingIds={citations.map((c) => c.paperId)}
            hasThesis={!!thesis}
            onAdded={reload}
          />
        </div>
      )}
    </section>
  );
}

const ROLE_OPTIONS: Array<{ value: 'thesis' | 'foundation' | 'reference'; label: string }> = [
  { value: 'thesis', label: 'Thesis' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'reference', label: 'Reference' },
];

// Founder-only inline control to link a paper to a live market. Posts to the
// existing founder-gated cite endpoint (own paper → auto-accepts; another
// author's paper → enters 'pending' until they accept) and reloads on success.
function AddPaperPanel({
  marketIdOrAddress,
  existingIds,
  hasThesis,
  onAdded,
}: {
  marketIdOrAddress: string;
  existingIds: string[];
  hasThesis: boolean;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<'thesis' | 'foundation' | 'reference'>(
    hasThesis ? 'foundation' : 'thesis',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (paper: PaperSearchResult) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/markets/${marketIdOrAddress}/cite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId: paper.id, role }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || 'Failed to link paper');
      setOpen(false);
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link paper');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-2 px-3 py-2 transition-colors"
        style={{ color: CREAM_DIM, border: `1px dashed ${HAIR_STRONG}` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = CREAM;
          e.currentTarget.style.borderColor = `${AMBER}66`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = CREAM_DIM;
          e.currentTarget.style.borderColor = HAIR_STRONG;
        }}
      >
        <Plus className="w-3.5 h-3.5" />
        Link a paper
      </button>
    );
  }

  return (
    <div
      className="p-4"
      style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR_STRONG}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="mono uppercase tracking-[0.22em] text-[0.55rem]" style={{ color: CREAM_DIM }}>
          Link a paper to this market
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="transition-colors"
          style={{ color: CREAM_FAINT }}
          onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Role picker — thesis disabled once one exists (a market has one thesis). */}
      <div className="inline-flex mb-3" style={{ border: `1px solid ${HAIR_STRONG}`, padding: 2 }}>
        {ROLE_OPTIONS.map((r) => {
          const disabled = r.value === 'thesis' && hasThesis;
          const active = r.value === role;
          return (
            <button
              key={r.value}
              type="button"
              disabled={disabled}
              onClick={() => setRole(r.value)}
              className="mono uppercase tracking-[0.18em] text-[0.55rem] px-3 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: active ? AMBER : 'transparent',
                color: active ? '#0a0814' : CREAM_DIM,
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div style={{ opacity: submitting ? 0.5 : 1, pointerEvents: submitting ? 'none' : 'auto' }}>
        <PaperSearchAutocomplete
          excludeIds={existingIds}
          onSelect={submit}
          placeholder="Search papers by title or author…"
          emptyHint="No matching papers. Publish one from the Research tab first."
        />
      </div>

      {submitting && (
        <p
          className="mono uppercase tracking-[0.2em] text-[0.5rem] mt-2 inline-flex items-center gap-1.5"
          style={{ color: CREAM_FAINT }}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          Linking…
        </p>
      )}
      {error && (
        <p className="text-sm mt-2" style={{ color: '#d67347', fontFamily: 'var(--font-fraunces, serif)' }}>
          {error}
        </p>
      )}
    </div>
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
      {paper.doi && (
        <a
          href={`https://doi.org/${paper.doi}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mono uppercase tracking-[0.18em] text-[0.5rem] inline-block mb-3 underline-offset-2 hover:underline"
          style={{ color: FOREST }}
          title={`Published · DOI ${paper.doi}`}
        >
          DOI {paper.doi}
        </a>
      )}
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
        {/* Read-only reception stat. Was previously styled like ✓/✗ vote
            buttons, but liking/disliking happens on the paper page — here it's
            just a quiet count. Hidden entirely when there's no reception yet. */}
        {paper.likeCount > 0 || paper.dislikeCount > 0 ? (
          <span
            className="mono uppercase tracking-[0.22em] text-[0.55rem]"
            style={{ color: INK_FAINT, fontFeatureSettings: '"tnum"' }}
          >
            {paper.likeCount} endorsed · {paper.dislikeCount} disputed
          </span>
        ) : (
          <span />
        )}
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
