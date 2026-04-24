'use client';

/**
 * <LiveNumber /> — smoothly animates between numeric values instead of
 * re-rendering the entire number each time the prop changes. When a balance
 * or count updates, the displayed digits roll/flow to the new value over
 * ~600ms, so the user sees the change happen in motion rather than as
 * a "flash + snap" refresh.
 *
 * Usage:
 *   <LiveNumber value={balance} decimals={4} prefix="$" />
 *   <LiveNumber value={solAmount} decimals={4} suffix=" SOL" />
 *   <LiveNumber value={count} />
 */

import React, { useEffect, useRef, useState } from 'react';

interface LiveNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number; // ms
  /** Locale-aware thousands separators (default: true) */
  grouping?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Render the newly-changed trailing digits in an accent color, default false */
  highlightChanged?: boolean;
  accentColor?: string;
}

// Ease-out cubic — fast start, gentle settle (matches the landing's cosmic motion language)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function formatNumber(value: number, decimals: number, grouping: boolean): string {
  if (!isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });
}

/**
 * Given two formatted number strings of the same length, find the index at
 * which they first differ. Used to optionally highlight only the digits that
 * actually ticked.
 */
function firstDiffIndex(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) return i;
  return len;
}

export function LiveNumber({
  value,
  decimals = 2,
  prefix,
  suffix,
  duration = 600,
  grouping = true,
  className,
  style,
  highlightChanged = false,
  accentColor = '#e89660',
}: LiveNumberProps) {
  // Start at current value so mount doesn't animate from 0
  const [displayed, setDisplayed] = useState<number>(value);
  // What the PREVIOUS "settled" value was — used to compute which digits changed
  const prevRef = useRef<number>(value);
  // Ongoing animation frame reference
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any in-flight animation so the new target wins
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const start = displayed;
    const end = value;

    // No change (or NaN) — snap and bail
    if (!isFinite(end) || start === end) {
      setDisplayed(end);
      prevRef.current = end;
      return;
    }

    const t0 = performance.now();

    const tick = (now: number) => {
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const current = start + (end - start) * eased;
      setDisplayed(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Animation complete — settle exactly on target and update "prev"
        setDisplayed(end);
        prevRef.current = end;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formatted = formatNumber(displayed, decimals, grouping);

  // Highlight the digits that ticked, from the first difference to the end
  if (highlightChanged && prevRef.current !== displayed) {
    const prevFormatted = formatNumber(prevRef.current, decimals, grouping);
    const diffAt = firstDiffIndex(prevFormatted, formatted);
    if (diffAt < formatted.length) {
      const stable = formatted.slice(0, diffAt);
      const changing = formatted.slice(diffAt);
      return (
        <span className={className} style={style}>
          {prefix}
          {stable}
          <span style={{ color: accentColor, transition: 'color 0.4s ease-out' }}>{changing}</span>
          {suffix}
        </span>
      );
    }
  }

  return (
    <span className={className} style={style}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default LiveNumber;
