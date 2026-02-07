'use client';

import { useState } from 'react';

const TOKEN_CA = '6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump';

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

  const shortCA = `${TOKEN_CA.slice(0, 4)}...${TOKEN_CA.slice(-4)}`;

  return (
    <div className="flex items-center gap-3">
      {/* CA with copy */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 rounded-md transition-all group"
        title="Click to copy full address"
      >
        <span className="text-[10px] text-gray-500 uppercase">CA</span>
        <code className="text-xs text-gray-300 font-mono">{shortCA}</code>
        {copied ? (
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* DexScreener */}
      <a
        href={`https://dexscreener.com/solana/${TOKEN_CA}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-green-400 hover:bg-green-400/10 rounded transition-all"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span className="hidden sm:inline">Dex</span>
      </a>

      {/* Pump.fun */}
      <a
        href={`https://pump.fun/coin/${TOKEN_CA}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-[#9efe6c] hover:bg-[#9efe6c]/10 rounded transition-all"
      >
        <span className="w-4 h-4 rounded-full bg-[#9efe6c] flex items-center justify-center text-[8px] font-bold text-black">P</span>
        <span className="hidden sm:inline">Pump</span>
      </a>
    </div>
  );
}
