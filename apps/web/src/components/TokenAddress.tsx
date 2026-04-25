'use client';

import { useState } from 'react';

const TOKEN_CA = '6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump';

// ── Cosmic-plant palette (matches the rest of the app) ──
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

export default function TokenAddress() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(TOKEN_CA);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shortCA = `${TOKEN_CA.slice(0, 4)}…${TOKEN_CA.slice(-4)}`;

  return (
    <div className="flex items-center gap-2">
      {/* Token CA — copy on click */}
      <button
        onClick={handleCopy}
        title="Click to copy full address"
        className="mono uppercase tracking-[0.18em] text-[0.55rem] inline-flex items-center gap-1.5 px-2 py-1 transition-colors group"
        style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = CREAM;
          e.currentTarget.style.borderColor = AMBER + '88';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = CREAM_DIM;
          e.currentTarget.style.borderColor = HAIR_STRONG;
        }}
      >
        <span style={{ color: AMBER }}>$PNL</span>
        <span
          style={{
            color: CREAM_DIM,
            textTransform: 'none',
            letterSpacing: '0.02em',
          }}
        >
          {shortCA}
        </span>
        {copied ? (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke={FOREST}
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>

      {/* DexScreener */}
      <a
        href={`https://dexscreener.com/solana/${TOKEN_CA}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1 px-2 py-1 transition-colors"
        style={{ color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = AMBER;
          e.currentTarget.style.borderColor = AMBER + '88';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = CREAM_FAINT;
          e.currentTarget.style.borderColor = HAIR_STRONG;
        }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="hidden sm:inline">Dex</span>
      </a>

      {/* Pump.fun */}
      <a
        href={`https://pump.fun/coin/${TOKEN_CA}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1 px-2 py-1 transition-colors"
        style={{ color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = AMBER;
          e.currentTarget.style.borderColor = AMBER + '88';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = CREAM_FAINT;
          e.currentTarget.style.borderColor = HAIR_STRONG;
        }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="2" width="16" height="20" rx="8" />
          <path d="M4 12h16" />
        </svg>
        <span className="hidden sm:inline">Pump</span>
      </a>
    </div>
  );
}
