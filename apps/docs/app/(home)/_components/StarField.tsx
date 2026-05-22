'use client';

// Cosmic starfield — three layers of stars, warm-color palette, gentle
// twinkle. Lifted from apps/web/src/app/page.tsx and simplified — no
// parallax scroll, no constellation lines, no shooting stars. Just
// atmosphere for the tree.
//
// Generated on mount so each visit gets a slightly different sky. The
// random seed is intentional editorial — feels handmade rather than
// asset-baked.

import { useEffect, useState } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  twinkleDur: number;
  twinkleDelay: number;
  layer: 0 | 1 | 2;
}

const COLORS = [
  { c: '#fff5e1', w: 0.50 }, // warm white
  { c: '#ffd7a8', w: 0.30 }, // gold
  { c: '#ffa366', w: 0.15 }, // amber
  { c: '#d99875', w: 0.05 }, // orange
];

function pickColor(rand = Math.random): string {
  const r = rand();
  let acc = 0;
  for (const { c, w } of COLORS) {
    acc += w;
    if (r <= acc) return c;
  }
  return COLORS[0].c;
}

export default function StarField() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    const generated: Star[] = [];
    // Far layer — 120 dim stars
    for (let i = 0; i < 120; i++) {
      generated.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 0.6,
        color: pickColor(),
        opacity: 0.45 + Math.random() * 0.35,
        twinkleDur: 4 + Math.random() * 5,
        twinkleDelay: Math.random() * 5,
        layer: 0,
      });
    }
    // Mid layer — 48 stars
    for (let i = 0; i < 48; i++) {
      generated.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1.4 + Math.random() * 1.1,
        color: pickColor(),
        opacity: 0.7 + Math.random() * 0.3,
        twinkleDur: 3 + Math.random() * 4,
        twinkleDelay: Math.random() * 5,
        layer: 1,
      });
    }
    // Near layer — 20 bright points
    for (let i = 0; i < 20; i++) {
      generated.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2.4 + Math.random() * 1.6,
        color: pickColor(),
        opacity: 0.85 + Math.random() * 0.15,
        twinkleDur: 2.5 + Math.random() * 3,
        twinkleDelay: Math.random() * 4,
        layer: 2,
      });
    }
    setStars(generated);
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: s.color,
            opacity: s.opacity,
            boxShadow:
              s.layer === 2
                ? `0 0 ${s.size * 2.5}px ${s.color}`
                : s.layer === 1
                ? `0 0 ${s.size * 1.5}px ${s.color}`
                : 'none',
            animation: `docStarTwinkle ${s.twinkleDur}s ease-in-out ${s.twinkleDelay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes docStarTwinkle {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
