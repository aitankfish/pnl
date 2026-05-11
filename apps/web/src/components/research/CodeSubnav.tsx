'use client';

/**
 * CodeSubnav
 *
 * Shared tab strip for the code surface — Overview / Issues / Pulls.
 * Active state is inferred from the current pathname so each page can
 * just mount this component without wiring extra props.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

export function CodeSubnav({
  paperId,
  openIssuesCount,
  openPullsCount,
}: {
  paperId: string;
  openIssuesCount?: number;
  openPullsCount?: number;
}) {
  const pathname = usePathname() || '';
  const tabs: Array<{
    label: string;
    href: string;
    badge?: number;
    match: (p: string) => boolean;
  }> = [
    {
      label: 'Overview',
      href: `/research/${paperId}/code`,
      match: (p) =>
        p === `/research/${paperId}/code` ||
        p.startsWith(`/research/${paperId}/code/blob`) ||
        p.startsWith(`/research/${paperId}/code/commit`),
    },
    {
      label: 'Issues',
      href: `/research/${paperId}/code/issues`,
      badge: openIssuesCount,
      match: (p) => p.startsWith(`/research/${paperId}/code/issues`),
    },
    {
      label: 'Pulls',
      href: `/research/${paperId}/code/pulls`,
      badge: openPullsCount,
      match: (p) => p.startsWith(`/research/${paperId}/code/pulls`),
    },
  ];

  return (
    <nav
      className="flex flex-wrap items-center gap-1 mb-6"
      style={{ borderBottom: `1px solid ${HAIR_STRONG}` }}
    >
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch
            className="mono uppercase tracking-[0.22em] text-[0.6rem] px-3 py-2 transition-colors inline-flex items-center gap-2"
            style={{
              color: active ? AMBER : CREAM_DIM,
              borderBottom: `2px solid ${active ? AMBER : 'transparent'}`,
              marginBottom: -1,
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = CREAM;
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = CREAM_DIM;
            }}
          >
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 && (
              <span
                className="mono text-[0.55rem]"
                style={{
                  color: active ? AMBER : CREAM_DIM,
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
