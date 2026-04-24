'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Module-level trigger so any component in the tree can fire a cinematic navigation
// without threading a context through every link.
type TransitionTrigger = (href: string, label?: string) => void;
let triggerFn: TransitionTrigger | null = null;

export function triggerRouteTransition(href: string, label?: string) {
  if (triggerFn) triggerFn(href, label);
  else {
    // Fallback — if the overlay isn't mounted yet, just hard-nav
    if (typeof window !== 'undefined') window.location.href = href;
  }
}

export default function RouteTransition() {
  const router = useRouter();
  const [active, setActive] = useState<{ href: string; label: string } | null>(null);

  useEffect(() => {
    triggerFn = (href, label = href) => {
      setActive({ href, label });
      // Let the outro render, then navigate at the peak.
      setTimeout(() => {
        router.push(href);
        // Leave the overlay visible while the new page mounts, then dissolve.
        setTimeout(() => setActive(null), 650);
      }, 620);
    };
    return () => {
      triggerFn = null;
    };
  }, [router]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 200 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        >
          {/* Dark base wash — the curtain */}
          <motion.div
            className="absolute inset-0"
            style={{ background: '#0a0814' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.96 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Radial warm glow blooming from center */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(232,150,96,0.45) 0%, rgba(138,58,16,0.22) 28%, transparent 55%)',
            }}
            initial={{ opacity: 0, scale: 0.35 }}
            animate={{ opacity: 1, scale: 1.25 }}
            exit={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Horizon line sweeping across */}
          <motion.div
            className="absolute left-0 right-0 h-px"
            style={{
              top: '50%',
              background:
                'linear-gradient(to right, transparent, rgba(232,150,96,0.7), transparent)',
              transformOrigin: 'center',
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* 12 photon streaks radiating outward from center */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * 360;
            const len = 140 + ((i * 13) % 60);
            return (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: '2px',
                  height: `${len}px`,
                  background:
                    'linear-gradient(to top, rgba(255,244,184,0.85) 0%, rgba(232,150,96,0.4) 60%, transparent 100%)',
                  transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                  transformOrigin: 'bottom center',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 0.9 }}
                exit={{ scaleY: 0, opacity: 0 }}
                transition={{
                  duration: 0.55,
                  delay: i * 0.015,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            );
          })}

          {/* Central pulsing seed */}
          <motion.div
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: '16px',
              height: '16px',
              background: '#fff4b8',
              boxShadow:
                '0 0 24px 8px rgba(255,244,184,0.7), 0 0 60px 16px rgba(232,150,96,0.4)',
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Destination label just below the seed */}
          {active?.label && (
            <motion.div
              className="absolute left-0 right-0 text-center mono uppercase"
              style={{
                top: '50%',
                marginTop: '3rem',
                color: '#ecb48a',
                fontSize: '0.72rem',
                letterSpacing: '0.38em',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span>·&nbsp;&nbsp;&nbsp;{active.label}&nbsp;&nbsp;&nbsp;·</span>
            </motion.div>
          )}

          {/* Fine scattered star flickers — adds cosmic depth during the peak */}
          {[
            [12, 22], [88, 18], [8, 74], [92, 80], [32, 12], [68, 14],
            [22, 88], [78, 86], [48, 6], [52, 94],
          ].map(([x, y], i) => (
            <motion.span
              key={`star-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: '2px',
                height: '2px',
                background: '#fff5e1',
                boxShadow: '0 0 6px rgba(255,245,225,0.8)',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0.5], scale: [0, 1.2, 1] }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.2 + i * 0.03,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
