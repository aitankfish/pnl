'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface EmailInputProps {
  onSubmit: (email: string) => void;
  onBack: () => void;
  isLoading: boolean;
  error?: string | null;
}

export function EmailInput({ onSubmit, onBack, isLoading, error }: EmailInputProps) {
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState('');

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setValidationError('Please enter a valid email address');
      return;
    }
    setValidationError('');
    onSubmit(email);
  };

  const displayError = validationError || error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="w-full max-w-md px-4"
    >
      <button
        onClick={onBack}
        disabled={isLoading}
        className="group inline-flex items-center gap-2 mb-8 mono text-[0.6rem] uppercase tracking-[0.26em] transition-colors disabled:opacity-40"
        style={{ color: '#8a7f72' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f4eee4')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
      >
        <span className="transition-transform group-hover:-translate-x-1">←</span>
        <span>Back</span>
      </button>

      <div className="mb-8">
        <div className="mono text-[0.62rem] uppercase tracking-[0.3em] mb-4 flex items-center gap-3" style={{ color: '#e89660' }}>
          <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
          <span>Email</span>
        </div>
        <h2
          className="serif leading-[1.05] tracking-[-0.02em] mb-3"
          style={{
            color: '#f4eee4',
            fontSize: 'clamp(1.6rem, 4vw, 2.25rem)',
            fontWeight: 400,
            fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 72",
          }}
        >
          What&rsquo;s your email?
        </h2>
        <p className="serif text-[0.95rem] leading-[1.55]" style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
          We&rsquo;ll send a verification code.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (validationError) setValidationError('');
            }}
            placeholder="you@domain.com"
            disabled={isLoading}
            autoFocus
            className="w-full px-4 py-4 mono text-[0.85rem] transition-all disabled:opacity-50"
            style={{
              background: 'rgba(244,238,228,0.04)',
              border: displayError ? '1px solid rgba(214,115,71,0.6)' : '1px solid rgba(244,238,228,0.12)',
              color: '#f4eee4',
              letterSpacing: '0.05em',
            }}
          />
          {displayError && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mono text-[0.58rem] uppercase tracking-[0.24em] mt-3"
              style={{ color: '#d67347' }}
            >
              {displayError}
            </motion.p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !email}
          className="group relative inline-flex items-center justify-between gap-3 px-6 py-4 mono text-[0.72rem] uppercase tracking-[0.24em] font-semibold transition-colors duration-300 w-full disabled:opacity-40"
          style={{ background: '#e89660', color: '#0a0814' }}
        >
          <span>{isLoading ? 'Sending…' : 'Send code'}</span>
          {!isLoading && (
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none" className="transition-transform duration-300 group-hover:translate-x-1.5">
              <path d="M1 5H19M19 5L14 1M19 5L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
          )}
          <span className="absolute -right-0 -top-0 w-2 h-2" style={{ background: '#0a0814' }} />
        </button>
      </form>
    </motion.div>
  );
}
