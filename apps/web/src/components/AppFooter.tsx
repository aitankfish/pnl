'use client';

// Compact editorial footer for the authenticated app. Single row of
// content sandwiched between a hairline + foliate ornament rule on top
// and a tight signature line on the bottom. Sits at ~120px tall on
// desktop — quiet enough to not compete with the product, but with
// enough cosmic-plant signature to feel like part of the brand.

import Link from 'next/link';
import TokenAddress from '@/components/TokenAddress';

// ── Cosmic-plant palette ──
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

const TwitterIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const DiscordIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

// Same foliate vine ornament used between sections on /launchpad —
// reusing the drawing language so the footer reads as part of the
// editorial system, not a separate widget.
function FoliateOrnament() {
  return (
    <svg viewBox="0 0 56 16" width="40" height="12" fill="none" aria-hidden>
      <path d="M 28 2 L 28 14" stroke={CREAM} strokeWidth="0.7" opacity="0.55" />
      <path
        d="M 28 8 C 22 7 18 4 16 8 C 18 12 22 9 28 8 Z"
        fill={CREAM}
        opacity="0.45"
        stroke={CREAM}
        strokeWidth="0.4"
      />
      <path
        d="M 28 8 C 34 6.5 38.5 3 41 7 C 38.5 11.5 34 9.5 28 8 Z"
        fill={AMBER}
        opacity="0.5"
        stroke={AMBER}
        strokeWidth="0.4"
      />
      <circle cx="28" cy="2" r="0.8" fill={AMBER} opacity="0.85" />
      <circle cx="28" cy="14" r="0.6" fill={CREAM} opacity="0.4" />
    </svg>
  );
}

function NavLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const linkProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' as const }
    : {};
  const className = 'mono uppercase tracking-[0.22em] text-[0.55rem] transition-colors';
  const onMouseEnter = (e: React.MouseEvent<HTMLElement>) =>
    ((e.currentTarget as HTMLElement).style.color = AMBER);
  const onMouseLeave = (e: React.MouseEvent<HTMLElement>) =>
    ((e.currentTarget as HTMLElement).style.color = CREAM_DIM);
  const style = { color: CREAM_DIM };
  if (external) {
    return (
      <a href={href} {...linkProps} className={className} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </Link>
  );
}

function SocialIconLink({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className="p-1.5 transition-colors"
      style={{ color: CREAM_FAINT }}
      onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
      onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
    >
      {children}
    </a>
  );
}

// Simple bullet separator used between inline link groups
const Sep = () => (
  <span aria-hidden style={{ color: HAIR_STRONG }} className="select-none">
    ·
  </span>
);

export default function AppFooter() {
  // Rolling issue number from day-of-year — magazine-masthead device
  // that increments naturally over time without us managing it.
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  const issueNumber = String(dayOfYear).padStart(3, '0');
  const year = today.getFullYear();

  return (
    <footer className="mt-12 sm:mt-16" style={{ color: CREAM }}>
      {/* Top decorative band — hairline + foliate flourish + italic tagline */}
      <div
        className="px-4 sm:px-6 py-3"
        style={{ borderTop: `1px solid ${HAIR}` }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
          <FoliateOrnament />
          <p
            className="italic text-center hidden sm:block"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.85rem',
              letterSpacing: '0.01em',
            }}
          >
            Plant ideas. Watch them grow.
          </p>
          <FoliateOrnament />
          <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
        </div>
      </div>

      {/* Main row — links · social · token */}
      <div className="px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
          {/* Mobile-only tagline (top band one is hidden <sm) */}
          <p
            className="italic sm:hidden basis-full text-center mb-1"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.85rem',
            }}
          >
            Plant ideas. Watch them grow.
          </p>

          {/* Wayfinding — How to buy / Privacy / Terms collapsed into Docs.
              See apps/web/HIDDEN_ROUTES.md for the hidden in-app routes that
              still 307 → docs.pnl.market for any legacy backlinks. */}
          <nav className="flex items-center gap-2.5">
            <NavLink href="/whitepaper">Whitepaper</NavLink>
            <Sep />
            <NavLink href="https://docs.pnl.market" external>Docs</NavLink>
          </nav>

          <span className="hidden sm:inline-block w-px h-3" style={{ background: HAIR_STRONG }} />

          {/* Social */}
          <div className="flex items-center gap-1">
            <SocialIconLink href="https://x.com/pnldotmarket" title="X / Twitter">
              <TwitterIcon className="w-3.5 h-3.5" />
            </SocialIconLink>
            <SocialIconLink href="https://discord.gg/38pkg4vm" title="Discord">
              <DiscordIcon className="w-3.5 h-3.5" />
            </SocialIconLink>
          </div>

          <span className="hidden md:inline-block w-px h-3" style={{ background: HAIR_STRONG }} />

          {/* Token */}
          <TokenAddress />
        </div>
      </div>

      {/* Bottom signature line */}
      <div
        className="px-4 sm:px-6 py-3"
        style={{ borderTop: `1px solid ${HAIR}` }}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <p
            className="mono uppercase tracking-[0.3em] text-[0.55rem]"
            style={{ color: CREAM_FAINT }}
          >
            © {year} PNL
          </p>
          <span style={{ color: HAIR_STRONG }} aria-hidden>
            ·
          </span>
          <p
            className="mono uppercase tracking-[0.3em] text-[0.55rem]"
            style={{ color: AMBER }}
          >
            No. {issueNumber}
          </p>
          <span style={{ color: HAIR_STRONG }} aria-hidden>
            ·
          </span>
          <p
            className="italic"
            style={{
              color: CREAM_FAINT,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.78rem',
            }}
          >
            built on Solana
          </p>
        </div>
      </div>
    </footer>
  );
}
