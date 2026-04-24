'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

// Warm cosmic starfield — matches the landing's ChapterStarfield component
// so the authenticated app feels continuous with the hero.
function WarmStarfield() {
  const [stars, setStars] = useState<
    Array<{ x: number; y: number; size: number; color: string; opacity: number; twinkleDur: number; twinkleDelay: number }>
  >([]);
  useEffect(() => {
    const COLORS = ['#fff5e1', '#ffd7a8', '#ffa366', '#d99875'];
    const generated = [];
    for (let i = 0; i < 200; i++) {
      generated.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 1.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: 0.28 + Math.random() * 0.4,
        twinkleDur: 3.5 + Math.random() * 5,
        twinkleDelay: Math.random() * 6,
      });
    }
    setStars(generated);
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Subtle radial warm glow centered */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(232,150,96,0.08) 0%, rgba(214,115,71,0.03) 35%, transparent 70%)',
        }}
      />
      {stars.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            borderRadius: '50%',
            background: s.color,
            opacity: s.opacity,
            boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            animation: `starTwinkle ${s.twinkleDur}s ease-in-out infinite`,
            animationDelay: `${s.twinkleDelay}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: var(--twinkle-min, 0.35); }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function AppLayout({ children, currentPage }: AppLayoutProps) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0a0814' }}>
      {/* Warm cosmic starfield — same palette as landing */}
      <WarmStarfield />

      {/* Top Navigation Bar */}
      <Sidebar currentPage={currentPage} />

      {/* Main Content */}
      <div className="flex-1 pt-24 overflow-y-auto relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
