'use client';

import { motion } from 'framer-motion';

interface CosmicLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CosmicLoader({ message, size = 'md' }: CosmicLoaderProps) {
  const sizeClasses = {
    sm: { container: 'w-12 h-12', particle: 'w-2 h-2', orbit: 20, center: 'w-4 h-4' },
    md: { container: 'w-20 h-20', particle: 'w-3 h-3', orbit: 30, center: 'w-8 h-8' },
    lg: { container: 'w-28 h-28', particle: 'w-4 h-4', orbit: 40, center: 'w-10 h-10' },
  };

  const s = sizeClasses[size];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center"
    >
      <div className={`relative ${s.container} mx-auto mb-4`}>
        {/* Orbiting particles */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`absolute ${s.particle} rounded-full`}
            style={{
              background: `linear-gradient(135deg, ${i === 0 ? '#06b6d4' : i === 1 ? '#a855f7' : '#ec4899'}, ${i === 0 ? '#3b82f6' : i === 1 ? '#6366f1' : '#f43f5e'})`,
              top: '50%',
              left: '50%',
              marginTop: `-${parseInt(s.particle.split(' ')[0].slice(2)) / 2}px`,
              marginLeft: `-${parseInt(s.particle.split(' ')[0].slice(2)) / 2}px`,
              boxShadow: `0 0 10px ${i === 0 ? '#06b6d4' : i === 1 ? '#a855f7' : '#ec4899'}`,
            }}
            animate={{
              x: [
                s.orbit * Math.cos((i * 2 * Math.PI) / 3),
                s.orbit * Math.cos((i * 2 * Math.PI) / 3 + Math.PI / 2),
                s.orbit * Math.cos((i * 2 * Math.PI) / 3 + Math.PI),
                s.orbit * Math.cos((i * 2 * Math.PI) / 3 + (3 * Math.PI) / 2),
                s.orbit * Math.cos((i * 2 * Math.PI) / 3),
              ],
              y: [
                s.orbit * Math.sin((i * 2 * Math.PI) / 3),
                s.orbit * Math.sin((i * 2 * Math.PI) / 3 + Math.PI / 2),
                s.orbit * Math.sin((i * 2 * Math.PI) / 3 + Math.PI),
                s.orbit * Math.sin((i * 2 * Math.PI) / 3 + (3 * Math.PI) / 2),
                s.orbit * Math.sin((i * 2 * Math.PI) / 3),
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.15,
            }}
          />
        ))}

        {/* Center pulse */}
        <motion.div
          className={`absolute inset-0 m-auto ${s.center} rounded-full bg-gradient-to-r from-purple-500 to-cyan-500`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {message && (
        <motion.p
          className="text-white text-base sm:text-lg text-center"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );
}
