'use client';

import React, { memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import '../styles/starry-background.css';

interface Star {
  top: number;
  left: number;
}

interface Constellation {
  name: string;
  stars: Star[];
  lines: number[][];
}

interface SpaceBackgroundProps {
  constellation: Constellation | null;
}

// Generate star data with seeded positions (deterministic)
interface ColorfulStar {
  size: string;
  color: string;
  left: number;
  top: number;
  duration: number;
  delay: number;
  glow: string;
}

// Seeded random function for consistent values
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Pre-generate star data with deterministic positions
function generateStarData(): ColorfulStar[] {
  const colors = [
    '#ffffff', '#93c5fd', '#c4b5fd', '#fde047', '#7dd3fc',
    '#fbbf24', '#f9a8d4', '#6ee7b7', '#d8b4fe', '#fb923c',
    '#60a5fa', '#a78bfa',
  ];

  return [...Array(400)].map((_, i) => {
    const sizeRand = seededRandom(i * 1);
    const size = sizeRand > 0.95 ? '3px' : sizeRand > 0.85 ? '2.5px' : sizeRand > 0.7 ? '2px' : sizeRand > 0.5 ? '1.5px' : '1px';
    const color = colors[Math.floor(seededRandom(i * 2) * colors.length)];
    const duration = 1.5 + seededRandom(i * 3) * 5;
    const delay = seededRandom(i * 4) * 6;
    const left = seededRandom(i * 5) * 100;
    const top = seededRandom(i * 6) * 100;
    const glow = size === '3px' ? '6px' : size === '2.5px' ? '5px' : size === '2px' ? '4px' : '2px';

    return { size, color, left, top, duration, delay, glow };
  });
}

// Pre-generate on module load (same on server and client)
const starData = generateStarData();

// Memoized component for space background - only re-renders when constellation changes
const SpaceBackground = memo(function SpaceBackground({ constellation }: SpaceBackgroundProps) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ willChange: 'transform' }}>
      {/* Large Stars - Very Bright */}
      {[...Array(30)].map((_, i) => (
        <div key={`large-${i}`} className="star star-large bg-white" style={{ willChange: 'transform, opacity' }}></div>
      ))}

      {/* Medium Stars */}
      {[...Array(60)].map((_, i) => (
        <div key={`medium-${i}`} className="star star-medium bg-white" style={{ willChange: 'transform, opacity' }}></div>
      ))}

      {/* Small Stars */}
      {[...Array(80)].map((_, i) => (
        <div key={`small-${i}`} className="star star-small bg-white" style={{ willChange: 'transform, opacity' }}></div>
      ))}

      {/* Sharp Twinkling Stars - Extra Bright */}
      {[...Array(25)].map((_, i) => (
        <div key={`sharp-${i}`} className="star-sharp star-small bg-white" style={{ willChange: 'transform, opacity' }}></div>
      ))}

      {/* Meteor Shower */}
      {[...Array(6)].map((_, i) => (
        <div key={`meteor-${i}`} className={`meteor meteor${i + 1}`} style={{ willChange: 'transform' }}></div>
      ))}

      {/* Shooting Stars - More for spectacular entrance */}
      {[...Array(10)].map((_, i) => (
        <div key={`shooting-${i}`} className={`shooting-star shooting-star${(i % 5) + 1}`} style={{ willChange: 'transform' }}></div>
      ))}

      {/* Comets */}
      {[...Array(3)].map((_, i) => (
        <div key={`comet-${i}`} className={`comet comet${i + 1}`} style={{ willChange: 'transform' }}></div>
      ))}

      {/* Nebula Clouds */}
      {[...Array(3)].map((_, i) => (
        <div key={`nebula-${i}`} className={`nebula nebula${i + 1}`} style={{ willChange: 'opacity' }}></div>
      ))}

      {/* Pulsars */}
      {[...Array(4)].map((_, i) => (
        <div key={`pulsar-${i}`} className={`pulsar pulsar${i + 1}`} style={{ willChange: 'opacity' }}></div>
      ))}

      {/* Aurora Borealis */}
      {[...Array(2)].map((_, i) => (
        <div key={`aurora-${i}`} className={`aurora aurora${i + 1}`} style={{ willChange: 'opacity' }}></div>
      ))}

      {/* Distant Galaxies */}
      {[...Array(3)].map((_, i) => (
        <div key={`galaxy-${i}`} className={`galaxy galaxy${i + 1}`} style={{ willChange: 'opacity' }}></div>
      ))}

      {/* Dense twinkling colorful stars - Landing page style */}
      {starData.map((star, i) => (
        <motion.div
          key={`colorful-star-${i}`}
          className="absolute rounded-full"
          style={{
            width: star.size,
            height: star.size,
            background: star.color,
            boxShadow: `0 0 ${star.glow} ${star.color}`,
            left: `${star.left}%`,
            top: `${star.top}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.4, 1, 0.4],
            scale: [0, 0.8, 1.2, 0.8],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Daily Constellation */}
      {constellation && (
        <>
          <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
            {/* Constellation connecting lines */}
            {constellation.lines.map((line, idx) => {
              const star1 = constellation.stars[line[0]];
              const star2 = constellation.stars[line[1]];
              return (
                <line
                  key={`line-${idx}`}
                  x1={`${star1.left}%`}
                  y1={`${star1.top}%`}
                  x2={`${star2.left}%`}
                  y2={`${star2.top}%`}
                  stroke="rgba(100, 200, 255, 0.15)"
                  strokeWidth="1"
                  className="constellation-line"
                />
              );
            })}
          </svg>

          {/* Constellation Stars */}
          {constellation.stars.map((star, idx) => (
            <div
              key={`constellation-star-${idx}`}
              className="constellation-star"
              style={{
                position: 'absolute',
                top: `${star.top}%`,
                left: `${star.left}%`,
                width: '4px',
                height: '4px',
                background: 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(100, 200, 255, 0.8) 50%, transparent 100%)',
                borderRadius: '50%',
                boxShadow: '0 0 8px rgba(100, 200, 255, 0.8), 0 0 12px rgba(100, 200, 255, 0.5)',
                zIndex: 2,
                willChange: 'transform',
              }}
            />
          ))}

          {/* Constellation Name Label */}
          <div
            className="constellation-label"
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              color: 'rgba(100, 200, 255, 0.25)',
              fontSize: '12px',
              fontWeight: '400',
              letterSpacing: '3px',
              textShadow: '0 0 5px rgba(100, 200, 255, 0.2)',
              zIndex: 2,
              pointerEvents: 'none',
              textTransform: 'uppercase',
            }}
          >
            {constellation.name}
          </div>
        </>
      )}
    </div>
  );
});

export default SpaceBackground;
