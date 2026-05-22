'use client';

import { useState } from 'react';

// One-click clipboard prompt for users who want to drop PNL context into
// their AI tool (Claude, ChatGPT, Cursor, Gemini, Codex, …). Same content
// regardless of tool — the protocol facts, the doc link, the public API,
// and a "Help me:" anchor so the user can append their own ask.
const AGENT_PROMPT = `I want to use PNL (Predict & Launch) — a conviction-market protocol on Solana that tokenizes ideas. Documentation lives at https://docs.pnl.market.

PNL turns ideas into tradeable markets: someone proposes an idea, the community stakes YES or NO with $PNL tokens, and ideas that win get launched and tokenized. It is non-custodial — every action is a Solana transaction signed by the user's wallet.

Key facts:
- Live on Solana mainnet
- Anchor program: C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86
- $PNL token mint: 6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump
- Public read API (no auth, 60 req/min): https://pnl.market/api/markets/list
- LLMs.txt summary: https://pnl.market/llms.txt
- Quickstart with copy-paste TypeScript: https://docs.pnl.market/docs/build/quickstart
- Architecture: https://docs.pnl.market/docs/build/architecture
- Manifesto (why this exists): https://docs.pnl.market/docs/manifesto

Help me:
`;

type Variant = 'overlay' | 'inline';

export default function AiCopyButton({ variant = 'inline' }: { variant?: Variant }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Older browsers / non-secure contexts: fall back to a textarea trick.
      const ta = document.createElement('textarea');
      ta.value = AGENT_PROMPT;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        // give up silently — at this point the user is on a very old browser
      }
      document.body.removeChild(ta);
    }
  };

  if (variant === 'overlay') {
    // Discreet corner pill on the desktop tree. The cosmic scene wants
    // negative space, so this stays small and warm-toned, only growing on
    // hover. Lives top-right inside the canvas viewport.
    return (
      <button
        onClick={handleCopy}
        className="group fixed top-20 right-5 z-40 inline-flex items-center gap-2
                   px-3 py-2 text-[0.62rem] font-mono uppercase tracking-[0.18em]
                   text-[#ecb48a] hover:text-[#fff5e1]
                   border border-[rgba(232,150,96,0.35)] hover:border-[rgba(232,150,96,0.8)]
                   bg-[rgba(10,8,20,0.6)] hover:bg-[rgba(10,8,20,0.85)]
                   backdrop-blur-md transition-all duration-300
                   hover:shadow-[0_0_24px_rgba(232,150,96,0.25)]"
        aria-label="Copy PNL context for your AI tool"
      >
        <CopyGlyph />
        <span>{copied ? 'Copied' : 'For your AI'}</span>
      </button>
    );
  }

  // Inline (mobile landing CTA). Larger, full-width within its parent stack.
  return (
    <button
      onClick={handleCopy}
      className="w-full inline-flex items-center justify-center gap-3
                 px-5 py-4 text-[0.72rem] font-mono uppercase tracking-[0.22em]
                 text-[#ecb48a] active:text-[#fff5e1]
                 border border-[rgba(232,150,96,0.4)] active:border-[rgba(232,150,96,0.9)]
                 bg-[rgba(10,8,20,0.5)] active:bg-[rgba(10,8,20,0.8)]
                 transition-all"
      aria-label="Copy PNL context for your AI tool"
    >
      <CopyGlyph />
      <span>{copied ? 'Copied — paste into your AI' : 'Copy for your AI tool'}</span>
    </button>
  );
}

function CopyGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="1.2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </svg>
  );
}
