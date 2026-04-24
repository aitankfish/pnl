'use client';

import { motion } from 'framer-motion';

interface CosmicLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

// Loader = a small cosmic seed/sun with orbiting amber photons, matching the landing's palette.
export function CosmicLoader({ message, size = 'md' }: CosmicLoaderProps) {
  const sizeMap = {
    sm: { container: 48, orbit: 18, particle: 3, core: 6 },
    md: { container: 80, orbit: 28, particle: 4, core: 10 },
    lg: { container: 112, orbit: 38, particle: 5, core: 14 },
  };
  const s = sizeMap[size];
  const half = s.container / 2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center"
    >
      <div className="relative mx-auto mb-5" style={{ width: s.container, height: s.container }}>
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: '1px solid rgba(232,150,96,0.25)' }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Central seed/sun */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: s.core,
            height: s.core,
            top: half - s.core / 2,
            left: half - s.core / 2,
            background: '#e89628',
            boxShadow: '0 0 16px rgba(232,150,40,0.7), 0 0 40px rgba(232,150,40,0.25)',
          }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* 3 orbiting photons at 120° offsets */}
        {[0, 1, 2].map((i) => {
          const phaseOffset = (i * 2 * Math.PI) / 3;
          const colors = ['#fff4b8', '#ecb48a', '#d99875'];
          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: s.particle,
                height: s.particle,
                top: half - s.particle / 2,
                left: half - s.particle / 2,
                background: colors[i],
                boxShadow: `0 0 8px ${colors[i]}`,
              }}
              animate={{
                x: [
                  s.orbit * Math.cos(phaseOffset),
                  s.orbit * Math.cos(phaseOffset + Math.PI / 2),
                  s.orbit * Math.cos(phaseOffset + Math.PI),
                  s.orbit * Math.cos(phaseOffset + (3 * Math.PI) / 2),
                  s.orbit * Math.cos(phaseOffset),
                ],
                y: [
                  s.orbit * Math.sin(phaseOffset),
                  s.orbit * Math.sin(phaseOffset + Math.PI / 2),
                  s.orbit * Math.sin(phaseOffset + Math.PI),
                  s.orbit * Math.sin(phaseOffset + (3 * Math.PI) / 2),
                  s.orbit * Math.sin(phaseOffset),
                ],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay: i * 0.15 }}
            />
          );
        })}
      </div>

      {message && (
        <motion.p
          className="mono text-[0.62rem] uppercase tracking-[0.28em] text-center"
          style={{ color: '#d8cfc0' }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );
}
