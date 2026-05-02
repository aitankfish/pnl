'use client';

/**
 * CodeSearchInput
 *
 * Form-style search input. Submitting (Enter) or clicking the icon
 * navigates the page to /research/[id]/code/search?q=<value>. We
 * deliberately don't search per-keystroke because GitHub's search-code
 * endpoint is tightly rate-limited (30 req/min authenticated).
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

export function CodeSearchInput({
  paperId,
  initialQuery = '',
  compact = false,
}: {
  paperId: string;
  initialQuery?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = value.trim();
    const target = q
      ? `/research/${paperId}/code/search?q=${encodeURIComponent(q)}`
      : `/research/${paperId}/code/search`;
    router.push(target);
  };

  return (
    <form onSubmit={submit} className="relative">
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
          compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
        }`}
        style={{ color: CREAM_FAINT }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          compact ? 'Search code…' : 'Search this repo (Enter to run)…'
        }
        className={`w-full focus:outline-none transition-colors ${
          compact ? 'pl-9 pr-9 py-2' : 'pl-10 pr-10 py-2.5'
        }`}
        style={{
          background: 'transparent',
          border: `1px solid ${HAIR_STRONG}`,
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: compact ? '0.85rem' : '0.95rem',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = AMBER)}
        onBlur={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className={`absolute right-3 top-1/2 -translate-y-1/2 ${
            compact ? '' : ''
          }`}
          style={{ color: CREAM_FAINT }}
          aria-label="Clear search"
        >
          <X className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>
      )}
    </form>
  );
}
