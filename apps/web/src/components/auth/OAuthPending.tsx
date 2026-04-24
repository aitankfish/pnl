'use client';

import { motion } from 'framer-motion';
import { CosmicLoader } from './CosmicLoader';
import type { OAuthProvider } from '@/hooks/useHeadlessAuth';

const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface OAuthPendingProps {
  provider: OAuthProvider;
  onCancel: () => void;
  error?: string | null;
  onRetry: () => void;
}

const providerNames: Record<OAuthProvider, string> = {
  google: 'Google',
  twitter: 'X',
};

export function OAuthPending({ provider, onCancel, error, onRetry }: OAuthPendingProps) {
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="w-full max-w-md px-4 text-center"
      >
        <div className="mono text-[0.62rem] uppercase tracking-[0.3em] mb-4 flex items-center justify-center gap-3" style={{ color: '#d67347' }}>
          <span className="inline-block w-8 h-px" style={{ background: '#d67347' }} />
          <span>Connection failed</span>
          <span className="inline-block w-8 h-px" style={{ background: '#d67347' }} />
        </div>
        <h3
          className="serif leading-[1.05] tracking-[-0.02em] mb-3"
          style={{
            color: '#f4eee4',
            fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
            fontWeight: 400,
            fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 72",
          }}
        >
          Something got in the way.
        </h3>
        <p className="serif text-[0.95rem] leading-[1.55] mb-8" style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
          {error}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onRetry}
            className="group relative inline-flex items-center justify-between gap-3 px-6 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] font-semibold transition-colors duration-300 w-full"
            style={{ background: '#e89660', color: '#0a0814' }}
          >
            <span>Try again</span>
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none" className="transition-transform duration-300 group-hover:translate-x-1.5">
              <path d="M1 5H19M19 5L14 1M19 5L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
            <span className="absolute -right-0 -top-0 w-2 h-2" style={{ background: '#0a0814' }} />
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-2 px-6 py-4 mono text-[0.7rem] uppercase tracking-[0.24em] transition-colors duration-300 w-full border"
            style={{ color: '#d8cfc0', borderColor: 'rgba(244,238,228,0.15)' }}
          >
            Go back
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="w-full max-w-md px-4 text-center"
    >
      <button
        onClick={onCancel}
        className="group inline-flex items-center gap-2 mb-10 mono text-[0.6rem] uppercase tracking-[0.26em] transition-colors mx-auto"
        style={{ color: '#8a7f72' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f4eee4')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
      >
        <span className="transition-transform group-hover:-translate-x-1">←</span>
        <span>Cancel</span>
      </button>

      <div className="mono text-[0.62rem] uppercase tracking-[0.3em] mb-4 flex items-center justify-center gap-3" style={{ color: '#e89660' }}>
        <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
        <span>{providerNames[provider]}</span>
        <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
      </div>

      <CosmicLoader message={`Connecting to ${providerNames[provider]}`} />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="serif italic text-[0.95rem] leading-[1.55] mt-8 max-w-[36ch] mx-auto"
        style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 30" }}
      >
        A popup window should have opened. Complete the login there to continue.
      </motion.p>
    </motion.div>
  );
}
