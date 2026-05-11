'use client';

/**
 * PaperSearchAutocomplete
 *
 * Reusable autocomplete for picking a research paper. Used by the
 * create-project flow (filtered to the founder's own papers via
 * `authorWallet`) and later by the cross-author citation flow (no scope).
 *
 * Behaviour:
 *  - Debounced search against /api/research/search (250ms)
 *  - Keyboard navigation: ↑ / ↓ / Enter / Escape
 *  - Click outside closes the panel
 *  - Already-selected paper IDs can be passed via `excludeIds` so they
 *    don't appear as options
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const AMBER_FAINT = 'rgba(232,150,96,0.25)';

export interface PaperSearchResult {
  id: string;
  title: string;
  authorName: string;
  authorWallet: string;
  authorXHandle: string | null;
  summary: string | null;
  paperUrl: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  authorWallet?: string;            // scope to a single author's papers
  excludeAuthorWallet?: string;     // hide a specific author's papers (cross-author picker)
  excludeIds?: string[];
  onSelect: (paper: PaperSearchResult) => void;
  placeholder?: string;
  emptyHint?: string;
}

export function PaperSearchAutocomplete({
  authorWallet,
  excludeAuthorWallet,
  excludeIds = [],
  onSelect,
  placeholder = 'Search your papers by title…',
  emptyHint = 'No papers match. Try a different word.',
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PaperSearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqIdRef = useRef(0);

  const visibleResults = useMemo(
    () => results.filter((r) => !excludeIds.includes(r.id)),
    [results, excludeIds],
  );

  // Debounced search effect.
  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(async () => {
      const id = ++reqIdRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (authorWallet) params.set('authorWallet', authorWallet);
        if (excludeAuthorWallet) {
          params.set('excludeAuthorWallet', excludeAuthorWallet);
        }
        params.set('limit', '8');
        const res = await fetch(`/api/research/search?${params.toString()}`);
        const json = await res.json();
        if (id !== reqIdRef.current) return; // stale
        if (json?.success) {
          setResults(json.data.results || []);
          setActiveIdx(0);
        } else {
          setResults([]);
        }
      } catch {
        if (id === reqIdRef.current) setResults([]);
      } finally {
        if (id === reqIdRef.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, open, authorWallet, excludeAuthorWallet]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const choose = useCallback(
    (paper: PaperSearchResult) => {
      onSelect(paper);
      setQuery('');
      setResults([]);
      setOpen(false);
      // Keep focus on the input so the user can keep adding papers.
      inputRef.current?.focus();
    },
    [onSelect],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(visibleResults.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = visibleResults[activeIdx];
      if (r) choose(r);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: CREAM_FAINT }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 transition-colors focus:outline-none"
          style={{
            background: 'transparent',
            border: `1px solid ${HAIR_STRONG}`,
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontSize: '0.95rem',
          }}
          onMouseEnter={(e) => {
            if (!open) e.currentTarget.style.borderColor = AMBER_FAINT;
          }}
          onMouseLeave={(e) => {
            if (!open) e.currentTarget.style.borderColor = HAIR_STRONG;
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: CREAM_FAINT }}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results panel */}
      {open && (
        <div
          className="absolute left-0 right-0 mt-2 z-30 max-h-[60vh] overflow-y-auto"
          style={{
            background: '#0a0814',
            border: `1px solid ${HAIR_STRONG}`,
          }}
        >
          {loading && (
            <div
              className="flex items-center gap-3 px-4 py-4"
              style={{ color: CREAM_DIM }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="mono uppercase tracking-[0.22em] text-[0.6rem]">
                searching…
              </span>
            </div>
          )}

          {!loading && visibleResults.length === 0 && (
            <div
              className="px-4 py-5"
              style={{ color: CREAM_DIM }}
            >
              <p
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                }}
              >
                {emptyHint}
              </p>
            </div>
          )}

          {!loading &&
            visibleResults.map((r, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent input blur from firing before the click.
                    e.preventDefault();
                  }}
                  onClick={() => choose(r)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className="w-full text-left px-4 py-3 transition-colors block"
                  style={{
                    background: active
                      ? 'rgba(232,150,96,0.08)'
                      : 'transparent',
                    borderBottom: `1px solid ${HAIR}`,
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <p
                      className="line-clamp-1"
                      style={{
                        color: CREAM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontSize: '1.02rem',
                        fontWeight: 400,
                      }}
                    >
                      {r.title}
                    </p>
                    <span
                      className="mono uppercase tracking-[0.2em] text-[0.5rem] flex-shrink-0"
                      style={{ color: AMBER }}
                    >
                      v{r.currentVersion}
                    </span>
                  </div>
                  <p
                    className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                    style={{ color: CREAM_FAINT }}
                  >
                    {r.authorName}
                    {r.authorXHandle ? ` · @${r.authorXHandle}` : ''}
                  </p>
                  {r.summary && (
                    <p
                      className="text-sm line-clamp-2 mt-1.5"
                      style={{
                        color: CREAM_DIM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        lineHeight: 1.4,
                      }}
                    >
                      {r.summary}
                    </p>
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
