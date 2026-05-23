/**
 * Whitepaper version history.
 *
 * Compact index of every published whitepaper version with one-line
 * summaries + permalinks. Lets readers track how the protocol's
 * thinking evolves over time without losing access to prior versions.
 */

import { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';

// ── Cosmic-plant palette ──
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

export const metadata: Metadata = {
  title: 'Whitepaper · Version history | PNL',
  description:
    'How the PNL whitepaper has evolved. Every published version, permalinked, with one-line summaries of what changed.',
  openGraph: {
    title: 'PNL Whitepaper · Version history',
    description:
      'How the PNL whitepaper has evolved. Every published version, permalinked.',
    url: `${BASE_URL}/whitepaper/history`,
    siteName: 'PNL',
    images: [
      {
        url: `${BASE_URL}/api/og?title=Whitepaper%20history&description=How%20the%20PNL%20whitepaper%20has%20evolved`,
        width: 1200,
        height: 630,
        alt: 'PNL Whitepaper · Version history',
      },
    ],
    type: 'article',
  },
};

interface Version {
  slug: string;          // URL path under /whitepaper/
  label: string;         // e.g. "v2.0"
  date: string;          // e.g. "May 2026"
  state: 'current' | 'archived';
  title: string;         // one-line title
  summary: string;       // 2-3 sentence prose summary of what's in this version
}

const VERSIONS: Version[] = [
  {
    slug: 'v2',
    label: 'v2.0',
    date: 'May 2026',
    state: 'current',
    title: 'Agent-native integration',
    summary:
      "Adds a new section on PNL's agent surface — the @pnl/mcp-server (v0.4.0, 16 tools, autosign + deep-link flows, encrypted-at-rest local wallet). Documents the trust model: non-custodial, autosign cap as a hard ceiling, sig-auth challenges payload-bound against tampering. Existing sections preserved verbatim from v1.",
  },
  {
    slug: 'v1',
    label: 'v1.0',
    date: 'December 2025',
    state: 'archived',
    title: 'Genesis',
    summary:
      "The founding document. Idea tokenization, conviction markets, AMM mechanics, fair launch via pump.fun, and the 'where dreamers meet believers' framing. Establishes the protocol mechanics, economics, and the long-form editorial voice that subsequent versions inherit.",
  },
];

export default function WhitepaperHistory() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0814', color: CREAM }}>
      <div className="max-w-3xl mx-auto px-6 sm:px-8 pt-20 sm:pt-28 pb-20">
        {/* Masthead */}
        <header className="text-center mb-14">
          <p
            className="mono uppercase tracking-[0.26em] text-[0.55rem] mb-4"
            style={{ color: CREAM_FAINT }}
          >
            Whitepaper · history
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 400,
              fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.012em',
              color: CREAM,
            }}
          >
            How our thinking has changed
          </h1>
          <p
            className="italic mx-auto max-w-md mt-4"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '1.1rem',
              lineHeight: 1.45,
            }}
          >
            Every published version of the PNL whitepaper, permalinked.
          </p>
        </header>

        {/* Version list */}
        <ol className="space-y-10" style={{ listStyle: 'none', paddingLeft: 0 }}>
          {VERSIONS.map((v, i) => (
            <li key={v.slug}>
              <Link
                href={`/whitepaper/${v.slug}`}
                className="block group"
                style={{ textDecoration: 'none' }}
              >
                <article
                  className="px-5 sm:px-6 py-6 transition-colors"
                  style={{
                    border: `1px solid ${HAIR_STRONG}`,
                    background: 'rgba(244,238,228,0.015)',
                  }}
                >
                  {/* Top row: chip + date */}
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                    <div className="inline-flex items-center gap-3 mono uppercase tracking-[0.22em] text-[0.6rem]">
                      <span
                        aria-hidden
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{
                          background: v.state === 'current' ? AMBER : CREAM_FAINT,
                          boxShadow:
                            v.state === 'current' ? `0 0 6px ${AMBER}` : 'none',
                        }}
                      />
                      <span style={{ color: CREAM }}>{v.label}</span>
                      <span aria-hidden style={{ color: HAIR_STRONG }}>·</span>
                      <span
                        style={{
                          color: v.state === 'current' ? AMBER : CREAM_FAINT,
                        }}
                      >
                        {v.state}
                      </span>
                    </div>
                    <span
                      className="mono uppercase tracking-[0.22em] text-[0.6rem]"
                      style={{ color: CREAM_DIM }}
                    >
                      {v.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h2
                    style={{
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontSize: '1.65rem',
                      fontWeight: 400,
                      lineHeight: 1.15,
                      color: CREAM,
                      marginBottom: '0.5rem',
                    }}
                    className="group-hover:text-[#ecb48a] transition-colors"
                  >
                    {v.title}
                  </h2>

                  {/* Summary */}
                  <p
                    style={{
                      color: CREAM_DIM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontSize: '1rem',
                      lineHeight: 1.6,
                      marginBottom: '1rem',
                    }}
                  >
                    {v.summary}
                  </p>

                  {/* Read CTA */}
                  <p
                    className="mono uppercase tracking-[0.26em] text-[0.6rem] transition-colors"
                    style={{ color: AMBER }}
                  >
                    Read {v.label} →
                  </p>
                </article>
              </Link>
              {i < VERSIONS.length - 1 && (
                <div
                  className="mx-auto mt-10 h-px w-24"
                  style={{ background: HAIR_STRONG }}
                />
              )}
            </li>
          ))}
        </ol>

        {/* Bottom — link back to canonical /whitepaper */}
        <div className="text-center mt-16" style={{ borderTop: `1px solid ${HAIR}`, paddingTop: '1.5rem' }}>
          <Link
            href="/whitepaper"
            className="mono uppercase tracking-[0.26em] text-[0.6rem] transition-colors hover:text-[#ecb48a]"
            style={{ color: CREAM_DIM }}
          >
            ← back to current whitepaper
          </Link>
        </div>
      </div>
    </div>
  );
}
