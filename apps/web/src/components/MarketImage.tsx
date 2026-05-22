'use client';

import React, { useState } from 'react';

// ─── MarketImage ─────────────────────────────────────────────────
//
// Drop-in replacement for `<img src={market.projectImageUrl} />` calls
// that need a graceful fallback when the founder didn't attach an
// image (or the URL 404s mid-render). When no usable image is
// available, renders a deterministic warm-gradient circle with the
// first 1-2 ticker letters set in the brand serif.
//
// Why deterministic: a market's fallback should look the same in the
// list, the detail page, and the OG card. Hashing the ticker into a
// fixed palette of cosmic-plant gradients gives that consistency
// without storing anything server-side.

const FALLBACK_GRADIENTS: ReadonlyArray<string> = [
  'linear-gradient(135deg, #e89660 0%, #c66a3f 100%)', // amber → terra
  'linear-gradient(135deg, #ecb48a 0%, #b8613a 100%)', // peach → sienna
  'linear-gradient(135deg, #d99875 0%, #7a4428 100%)', // sandstone → earth
  'linear-gradient(135deg, #3f7a42 0%, #1f4a24 100%)', // forest light → dark
  'linear-gradient(135deg, #e89628 0%, #7a4428 100%)', // sun → root
  'linear-gradient(135deg, #ecb48a 0%, #3f7a42 100%)', // peach → forest
];

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickGradient(seed: string): string {
  return FALLBACK_GRADIENTS[hashString(seed) % FALLBACK_GRADIENTS.length];
}

function initialsFor(ticker: string): string {
  const cleaned = ticker.trim().toUpperCase();
  if (!cleaned) return '?';
  // 1-3 char tickers: show the whole symbol.
  if (cleaned.length <= 3) return cleaned;
  // 4-character tickers: first two chars stay legible at thumbnail size.
  if (cleaned.length <= 5) return cleaned.slice(0, 2);
  // Longer: just the leading letter.
  return cleaned[0];
}

export interface MarketImageProps {
  /** Project / market image URL (e.g. project.projectImageUrl). */
  src?: string | null;
  /** Ticker symbol used to derive the fallback letter + gradient seed. */
  ticker?: string | null;
  /** Display name, used as alt text and for the gradient seed if no ticker. */
  name?: string | null;
  /** Rendered size in pixels — must be set so the circle/img shares dimensions. */
  size?: number;
  /** Extra className appended after the base styles. */
  className?: string;
  /** Override the border-radius. Default is full circle. */
  rounded?: 'full' | 'lg' | 'md' | 'sm' | 'none';
  /** Alt text override. */
  alt?: string;
  /** Optional `style` overrides for the outer element. */
  style?: React.CSSProperties;
}

const RADIUS: Record<NonNullable<MarketImageProps['rounded']>, string> = {
  full: '9999px',
  lg: '12px',
  md: '8px',
  sm: '6px',
  none: '0',
};

export function MarketImage({
  src,
  ticker,
  name,
  size = 56,
  className,
  rounded = 'full',
  alt,
  style,
}: MarketImageProps) {
  const [errored, setErrored] = useState(false);
  const shouldFallback = !src || errored;

  const seed = (ticker || name || '?').trim().toUpperCase();
  const initials = initialsFor(ticker || name || '');
  const gradient = pickGradient(seed);
  const borderRadius = RADIUS[rounded];

  const dimensions: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius,
    flexShrink: 0,
  };

  if (!shouldFallback) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src as string}
        alt={alt ?? name ?? ticker ?? 'market'}
        onError={() => setErrored(true)}
        className={className}
        style={{ ...dimensions, objectFit: 'cover', ...style }}
      />
    );
  }

  // Letter scales with circle size so the initials always feel weighty.
  // The brand serif (.serif class binds to Fraunces in globals.css) keeps
  // it editorial rather than logo-y.
  const letterFontSize = Math.round(size * (initials.length === 1 ? 0.5 : initials.length === 2 ? 0.4 : 0.3));

  return (
    <div
      className={className}
      role="img"
      aria-label={alt ?? name ?? ticker ?? 'market'}
      style={{
        ...dimensions,
        background: gradient,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff5e1',
        // Subtle inner shadow + outer warmth so the circle has presence
        // at small thumbnail sizes without overpowering the layout.
        boxShadow:
          'inset 0 1px 0 rgba(255,245,225,0.18), 0 1px 3px rgba(58,28,13,0.35)',
        userSelect: 'none',
        ...style,
      }}
    >
      <span
        className="serif"
        style={{
          fontSize: letterFontSize,
          fontWeight: 600,
          letterSpacing: initials.length > 1 ? '-0.02em' : '0',
          lineHeight: 1,
          textShadow: '0 1px 2px rgba(58,28,13,0.4)',
        }}
      >
        {initials}
      </span>
    </div>
  );
}

export default MarketImage;
