'use client';

/**
 * BranchPicker
 *
 * Click the chip to open a dropdown of the repo's branches. Selecting
 * pushes ?ref=<branch> into the URL — the page reads it, refetches,
 * and the FileTree picks up the new ref via prop. Default branch is
 * always pinned to the top.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Check, ChevronDown, GitBranch, Loader2, Search } from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

export function BranchPicker({
  paperId,
  defaultBranch,
  current,
}: {
  paperId: string;
  defaultBranch: string;
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy-fetch branches the first time the picker opens. They're cached
  // server-side anyway, but no point pulling the list for visitors who
  // don't interact with the picker.
  useEffect(() => {
    if (!open || branches !== null) return;
    setLoading(true);
    setError(null);
    fetch(`/api/research/${paperId}/repo/branches`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setBranches(json.data.branches || []);
        } else {
          setError(json?.error || 'Failed to load branches');
        }
      })
      .catch(() => setError('Failed to load branches'))
      .finally(() => setLoading(false));
  }, [open, paperId, branches]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Sort: default branch first, then the rest alphabetically. Matches
  // the convention every other repo browser uses.
  const sorted = useMemo(() => {
    if (!branches) return [];
    const def = branches.find((b) => b.name === defaultBranch);
    const rest = branches
      .filter((b) => b.name !== defaultBranch)
      .sort((a, b) => a.name.localeCompare(b.name));
    return def ? [def, ...rest] : rest;
  }, [branches, defaultBranch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((b) => b.name.toLowerCase().includes(q));
  }, [sorted, query]);

  const choose = (name: string) => {
    setOpen(false);
    setQuery('');
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (name === defaultBranch) {
      params.delete('ref'); // default branch is the implicit "no ref"
    } else {
      params.set('ref', name);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : (pathname || '/'));
  };

  const isCurrent = (name: string) =>
    name === current || (current === defaultBranch && name === defaultBranch);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 mono uppercase tracking-[0.22em] text-[0.55rem] transition-colors"
        style={{
          color: CREAM_DIM,
          border: `1px solid ${HAIR_STRONG}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = CREAM;
          e.currentTarget.style.borderColor = `${AMBER}66`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = CREAM_DIM;
          e.currentTarget.style.borderColor = HAIR_STRONG;
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <GitBranch className="w-3 h-3" />
        <span style={{ color: CREAM, fontFeatureSettings: '"tnum"' }}>
          {current}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-2 z-30"
          style={{
            background: '#0a0814',
            border: `1px solid ${HAIR_STRONG}`,
            minWidth: 280,
            maxWidth: 360,
            boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
          }}
          role="listbox"
        >
          <div
            className="px-3 py-2 flex items-center gap-2"
            style={{ borderBottom: `1px solid ${HAIR_STRONG}` }}
          >
            <Search
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: CREAM_FAINT }}
            />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter branches…"
              className="w-full bg-transparent outline-none mono text-[0.7rem]"
              style={{ color: CREAM, letterSpacing: '0.04em' }}
            />
          </div>

          <div
            className="max-h-72 overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            {loading && (
              <div
                className="flex items-center gap-2 px-3 py-3"
                style={{ color: CREAM_DIM }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="mono uppercase tracking-[0.22em] text-[0.55rem]">
                  loading branches…
                </span>
              </div>
            )}
            {error && (
              <p
                className="px-3 py-3 italic"
                style={{
                  color: CREAM_DIM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '0.85rem',
                }}
              >
                {error}
              </p>
            )}
            {!loading && !error && filtered.length === 0 && (
              <p
                className="px-3 py-4 italic text-center"
                style={{
                  color: CREAM_FAINT,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '0.85rem',
                }}
              >
                {branches && branches.length === 0
                  ? 'No branches.'
                  : 'No matches.'}
              </p>
            )}
            {!loading && !error && filtered.length > 0 && (
              <ul>
                {filtered.map((b) => {
                  const isDefault = b.name === defaultBranch;
                  const selected = isCurrent(b.name);
                  return (
                    <li key={b.name}>
                      <button
                        type="button"
                        onClick={() => choose(b.name)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                        style={{
                          background: selected
                            ? 'rgba(232,150,96,0.08)'
                            : 'transparent',
                          borderBottom: `1px solid ${HAIR}`,
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) {
                            e.currentTarget.style.background =
                              'rgba(244,238,228,0.04)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <Check
                          className="w-3 h-3 flex-shrink-0"
                          style={{
                            color: selected ? AMBER : 'transparent',
                          }}
                        />
                        <span
                          className="mono text-[0.7rem] flex-1 truncate"
                          style={{ color: selected ? AMBER : CREAM }}
                        >
                          {b.name}
                        </span>
                        {isDefault && (
                          <span
                            className="mono uppercase tracking-[0.18em] text-[0.5rem] flex-shrink-0"
                            style={{ color: CREAM_FAINT }}
                          >
                            default
                          </span>
                        )}
                        {b.protected && !isDefault && (
                          <span
                            className="mono uppercase tracking-[0.18em] text-[0.5rem] flex-shrink-0"
                            style={{ color: CREAM_FAINT }}
                          >
                            protected
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
