'use client';

// Wrapper for static legal/info pages (privacy, terms, how-to-buy, etc).
// Provides the editorial header (eyebrow + Fraunces display title +
// "last updated" timestamp + back link) and a content container with
// `.editorial-doc` styling — child semantic HTML (h2 / p / ul / li /
// strong / a) gets cosmic-plant typography automatically via globals.css.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

interface EditorialDocProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}

export default function EditorialDoc({
  eyebrow,
  title,
  subtitle,
  lastUpdated,
  backHref = '/launchpad',
  backLabel = 'Back to the grove',
  children,
}: EditorialDocProps) {
  return (
    <div className="px-4 sm:px-6 pb-20" style={{ color: CREAM }}>
      <div className="max-w-2xl mx-auto pt-6 sm:pt-10">
        {/* Back link — small mono small-caps, not a chunky button */}
        <Link
          href={backHref}
          className="mono uppercase tracking-[0.26em] text-[0.55rem] inline-flex items-center gap-1.5 mb-10 transition-colors"
          style={{ color: CREAM_FAINT }}
          onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
        >
          <ArrowLeft className="w-3 h-3" />
          {backLabel}
        </Link>

        {/* Editorial header */}
        <header className="mb-10 sm:mb-14">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
            style={{ color: AMBER }}
          >
            {eyebrow}
          </p>
          <h1
            className="leading-[1.05]"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 350,
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
              fontFeatureSettings: '"ss01"',
              letterSpacing: '-0.012em',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-3 italic max-w-prose"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '1.05rem',
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          )}
          {lastUpdated && (
            <p
              className="mono uppercase tracking-[0.24em] text-[0.55rem] mt-4"
              style={{ color: CREAM_FAINT }}
            >
              Last updated · {lastUpdated}
            </p>
          )}
        </header>

        {/* Body — child h2/p/ul/li get styled via globals.css .editorial-doc */}
        <div className="editorial-doc">{children}</div>
      </div>
    </div>
  );
}
