'use client';

// /ask — PNL House Agent concierge, Phase 0 chat surface.
// Talks to POST /api/concierge (read-only, non-custodial). The agent answers
// from live market data and hands back deep-links the user signs themselves.
//
// Layout follows the ChatGPT/Grok pattern: the composer sits centered in the
// viewport when the chat is empty, then drops to a pinned bottom bar (messages
// scroll above it) once a conversation starts. The page is sized to the
// viewport minus the global nav so the composer is always in view.

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Link from 'next/link';
import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { Sparkles, ArrowUp, Square, KeyRound, Settings } from 'lucide-react';
import { loadByok, byokHeaders } from '@/lib/agent/byok-shared';
import { MarketCardStack, type ConciergeMarket } from '@/components/concierge/MarketCard';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.12)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

const SUGGESTIONS = [
  "What's live on PNL right now?",
  'Find markets about AI agents',
  'How does a conviction market work?',
  'Which markets are closing soon?',
];

// Render assistant text with clickable links, no dangerouslySetInnerHTML.
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 break-all"
            style={{ color: AMBER }}
          >
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text as string)
    .join('');
}

function usedTools(parts: { type: string }[]): boolean {
  return parts.some((p) => p.type.startsWith('tool-'));
}

// Pull market data out of the agent's tool-call results so we can render rich
// interactive cards instead of plain text. Deduped by market id.
function collectMarkets(
  parts: { type: string; state?: string; output?: unknown }[],
): ConciergeMarket[] {
  const out: ConciergeMarket[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (p.state !== 'output-available' || !p.output) continue;
    let arr: ConciergeMarket[] = [];
    const o = p.output as { markets?: ConciergeMarket[] } & ConciergeMarket & ConciergeMarket[];
    if (p.type === 'tool-browse_markets') arr = o.markets ?? [];
    else if (p.type === 'tool-search_markets') arr = Array.isArray(p.output) ? (p.output as ConciergeMarket[]) : [];
    else if (p.type === 'tool-get_market') arr = o?.id ? [o] : [];
    for (const mk of arr) {
      if (mk?.id && !seen.has(mk.id)) {
        seen.add(mk.id);
        out.push(mk);
      }
    }
  }
  return out;
}

export default function AskPage() {
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => {
    const check = () => setHasKey(!!loadByok());
    setMounted(true);
    check();
    // Re-check when returning from Settings (focus) so the CTA flips to the composer.
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  // Memoized so useChat keeps one transport; the headers fn reads the latest
  // key from localStorage on every request (BYOK, never persisted server-side).
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/concierge', headers: () => byokHeaders() }),
    [],
  );
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const busy = status === 'submitted' || status === 'streaming';
  const hasMessages = messages.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput('');
  }

  // Shared composer — centered when empty, pinned to the bottom once chatting.
  const composer = (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 rounded-2xl border px-3 py-2"
        style={{ borderColor: HAIR, background: 'rgba(244,238,228,0.04)' }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          autoFocus
          placeholder="Ask about a market, a category, or how PNL works…"
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:opacity-50"
          style={{ color: CREAM, maxHeight: 160 }}
        />
        {busy ? (
          <button
            type="button"
            onClick={() => stop()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(244,238,228,0.10)', color: CREAM }}
            aria-label="Stop"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-30"
            style={{ background: AMBER, color: '#1a1208' }}
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </form>
      {error && (
        <p className="mt-2 text-center text-xs" style={{ color: '#e0876f' }}>
          Couldn&apos;t reach your model — check your key in{' '}
          <Link href="/settings" className="underline" style={{ color: AMBER }}>
            Settings
          </Link>
          .
        </p>
      )}
      <p className="mt-2 text-center text-[11px]" style={{ color: CREAM_FAINT }}>
        The concierge reads public market data and never signs transactions or holds funds.
      </p>
    </div>
  );

  return (
    <div className="relative flex flex-col h-[calc(100dvh-64px)] sm:h-[calc(100dvh-72px)] text-white">
      {/* AI key settings shortcut */}
      <Link
        href="/settings"
        className="absolute right-3 top-2 z-10 rounded-lg p-2 opacity-50 transition-opacity hover:opacity-100"
        style={{ color: CREAM_DIM }}
        title="AI key settings"
      >
        <Settings className="h-4 w-4" />
      </Link>
      {hasMessages ? (
        <>
          {/* Conversation — scrolls above the pinned composer */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6">
            <div className="mx-auto max-w-3xl py-6 space-y-5">
              {messages.map((m) => {
                const parts = m.parts as { type: string; text?: string; state?: string; output?: unknown }[];
                const text = messageText(parts);
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div
                        className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                        style={{ background: 'rgba(232,150,96,0.14)', color: CREAM }}
                      >
                        {text}
                      </div>
                    </div>
                  );
                }
                // Assistant: text bubble + rich, interactive market cards from tool output.
                const markets = collectMarkets(parts);
                return (
                  <div key={m.id} className="flex flex-col items-start gap-2">
                    {text ? (
                      <div
                        className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                        style={{ background: 'rgba(244,238,228,0.05)', color: CREAM }}
                      >
                        <Linkified text={text} />
                      </div>
                    ) : markets.length === 0 && usedTools(parts) ? (
                      <div
                        className="rounded-2xl px-4 py-2.5 text-sm"
                        style={{ background: 'rgba(244,238,228,0.05)', color: CREAM_FAINT }}
                      >
                        Looking at live markets…
                      </div>
                    ) : null}
                    {markets.length > 0 && (
                      <div className="w-full max-w-[92%]">
                        <MarketCardStack markets={markets} />
                      </div>
                    )}
                  </div>
                );
              })}

              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: FOREST }} />
                    <span className="text-xs" style={{ color: CREAM_FAINT }}>
                      thinking…
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pinned composer */}
          <div className="px-4 pb-4 sm:px-6">
            <div className="mx-auto max-w-3xl">{composer}</div>
          </div>
        </>
      ) : (
        // Empty state — everything centered in the viewport, ChatGPT-style.
        <div className="flex flex-1 items-center justify-center px-4 sm:px-6">
          <div className="w-full max-w-2xl pb-[8vh]">
            <div className="mb-6 text-center">
              <div
                className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full"
                style={{ background: 'rgba(232,150,96,0.14)' }}
              >
                <Sparkles className="h-5 w-5" style={{ color: AMBER }} />
              </div>
              <h1 className="text-2xl font-medium" style={{ color: CREAM }}>
                What do you want to know about PNL?
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: CREAM_DIM }}>
                A coordination market for ideas on Solana. I read live market data and hand you
                links to sign in your own wallet — I never hold keys.
              </p>
            </div>

            {!mounted ? null : hasKey ? (
              <>
                {composer}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
                      style={{ borderColor: HAIR, color: CREAM_DIM }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border p-6 text-center" style={{ borderColor: HAIR }}>
                <div
                  className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: 'rgba(232,150,96,0.12)' }}
                >
                  <KeyRound className="h-5 w-5" style={{ color: AMBER }} />
                </div>
                <p className="text-sm" style={{ color: CREAM }}>
                  Bring your own AI key to chat with the concierge.
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs" style={{ color: CREAM_FAINT }}>
                  OpenRouter, Anthropic, OpenAI, or Google. Your key stays in your browser — PNL
                  never stores it.
                </p>
                <Link
                  href="/settings"
                  className="mt-4 inline-block rounded-xl px-4 py-2 text-sm font-medium"
                  style={{ background: AMBER, color: '#1a1208' }}
                >
                  Add your key in Settings
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
