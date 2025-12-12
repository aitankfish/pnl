'use client';

import React, { memo } from 'react';
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

// Memoized component for space background - only re-renders when constellation changes
const SpaceBackground = memo(function SpaceBackground({ constellation }: SpaceBackgroundProps) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ willChange: 'transform' }}>
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
