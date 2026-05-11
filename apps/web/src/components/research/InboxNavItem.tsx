'use client';

/**
 * InboxNavItem
 *
 * Small icon button rendered in the masthead's right cluster. Renders
 * nothing when the connected wallet has no pending citations, so the nav
 * stays uncluttered for everyone but cited researchers.
 */

import React from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { usePendingCitations } from '@/hooks/usePendingCitations';

const AMBER = '#e89660';
const CREAM = '#f4eee4';
const CREAM_DIM = '#d8cfc0';

export function InboxNavItem({ active = false }: { active?: boolean }) {
  const { count } = usePendingCitations();
  if (count === 0) return null;

  return (
    <Link
      href="/research/inbox"
      aria-label={`Citation inbox · ${count} pending`}
      className="relative inline-flex items-center justify-center w-9 h-9 transition-colors"
      style={{ color: active ? AMBER : CREAM_DIM }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = CREAM;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = CREAM_DIM;
      }}
    >
      <Inbox className="w-4 h-4" />
      <span
        className="absolute -top-0.5 -right-0.5 mono"
        style={{
          background: AMBER,
          color: '#0a0814',
          fontSize: '0.55rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          minWidth: 16,
          height: 16,
          padding: '0 4px',
          borderRadius: 2,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {count > 9 ? '9+' : count}
      </span>
    </Link>
  );
}
