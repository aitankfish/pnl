// Plant-themed icon system — custom SVG glyphs that reinforce the cosmic-plant brand
// everywhere icons appear in the app (navbar, action buttons, empty states, etc.)

import React from 'react';

type IconProps = { className?: string; strokeWidth?: number };

// SEED with tiny sprout — "plant an idea" action.
export const SeedIcon = ({ className = '', strokeWidth = 1.3 }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
    {/* seed */}
    <ellipse cx="10" cy="15.5" rx="2.4" ry="2" fill="currentColor" />
    {/* stem */}
    <path
      d="M10 13.2 Q 9 9 11 6"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    {/* leaf */}
    <path
      d="M11 6 C 13.6 5.4 13.8 3 11.4 3 L 10.6 5.1 Z"
      fill="currentColor"
      fillOpacity="0.85"
    />
  </svg>
);

// TREE with stacked canopy — "browse the forest of ideas" / markets.
export const TreeIcon = ({ className = '', strokeWidth = 1.3 }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
    {/* trunk */}
    <path d="M10 17 V11" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* canopy — three overlapping circles for a soft cloud-like crown */}
    <circle cx="10" cy="6" r="3" fill="currentColor" fillOpacity="0.5" />
    <circle cx="6.6" cy="9" r="2.3" fill="currentColor" fillOpacity="0.4" />
    <circle cx="13.4" cy="9" r="2.3" fill="currentColor" fillOpacity="0.4" />
  </svg>
);

// BLOOM flower on a stem — "launched, it bloomed" / shipped projects.
export const BloomIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
    {/* stem */}
    <path d="M10 17 V11" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
    {/* 4 petals around a center */}
    <circle cx="10" cy="5" r="2.1" fill="currentColor" />
    <circle cx="6.6" cy="7.5" r="2" fill="currentColor" fillOpacity="0.75" />
    <circle cx="13.4" cy="7.5" r="2" fill="currentColor" fillOpacity="0.75" />
    <circle cx="10" cy="10" r="1.8" fill="currentColor" fillOpacity="0.6" />
    {/* center dot */}
    <circle cx="10" cy="7" r="1.1" fill="#0a0814" fillOpacity="0.85" />
  </svg>
);

// LEAF with vein — for notifications (new growth = new signal).
export const LeafIcon = ({ className = '', strokeWidth = 1.2 }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
    <path
      d="M10.5 17 Q 4 13.5 4.5 7.5 Q 8.5 3 12.5 5 Q 16.5 8 16 13 Q 12 17 10.5 17 Z"
      fill="currentColor"
      fillOpacity="0.4"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.5 17 L 14 8"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// ROOT system — for wallet / resources (what nourishes you).
export const RootIcon = ({ className = '', strokeWidth = 1.3 }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
    {/* sun/seed head */}
    <circle cx="10" cy="5" r="2.4" fill="currentColor" />
    {/* three tapering roots */}
    <path
      d="M10 7 Q 10 11 7.5 15 M10 7 Q 10 11 10 16 M10 7 Q 10 11 12.5 15"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    {/* finer capillaries */}
    <path
      d="M7.5 15 Q 6 16 5.5 17 M12.5 15 Q 14 16 14.5 17"
      stroke="currentColor"
      strokeWidth={strokeWidth * 0.7}
      strokeLinecap="round"
      opacity="0.6"
    />
  </svg>
);

// BASKET — for merch / gathering (harvest metaphor).
export const BasketIcon = ({ className = '', strokeWidth = 1.3 }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
    {/* basket body */}
    <path
      d="M4 8 L 6 16 H 14 L 16 8 Z"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.2"
    />
    {/* weave */}
    <path d="M6.5 11 H 13.5 M6.2 13.5 H 13.8" stroke="currentColor" strokeWidth={strokeWidth * 0.7} opacity="0.55" />
    {/* handle */}
    <path
      d="M7 8 Q 10 3 13 8"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// SUN — small warm disc for status indicators, loading, etc.
export const SunIcon = ({ className = '', strokeWidth = 1.2 }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
    <circle cx="10" cy="10" r="3" fill="currentColor" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
      <line
        key={i}
        x1="10"
        y1="3.5"
        x2="10"
        y2="5.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        transform={`rotate(${a} 10 10)`}
      />
    ))}
  </svg>
);
