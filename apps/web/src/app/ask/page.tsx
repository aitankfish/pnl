'use client';

// /ask — PNL House Agent concierge, Phase 0 chat surface.
// Talks to POST /api/concierge (read-only, non-custodial). The agent answers
// from live market data and hands back deep-links the user signs themselves.

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, Fragment } from 'react';
import { Sparkles, ArrowUp, Square } from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.10)';
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

export default function AskPage() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/concierge' }),
  });
  const busy = status === 'submitted' || status === 'streaming';
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b px-4 py-4 sm:px-6" style={{ borderColor: HAIR }}>
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'rgba(232,150,96,0.14)' }}
          >
            <Sparkles className="h-4 w-4" style={{ color: AMBER }} />
          </div>
          <div>
            <h1 className="text-sm font-medium" style={{ color: CREAM }}>
              PNL Concierge
            </h1>
            <p className="text-xs" style={{ color: CREAM_FAINT }}>
              Ask about live markets · I link, you sign · not financial advice
            </p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="mx-auto max-w-3xl py-6 space-y-5">
          {messages.length === 0 && (
            <div className="pt-8">
              <p className="text-lg" style={{ color: CREAM }}>
                What do you want to know about PNL?
              </p>
              <p className="mt-1 text-sm" style={{ color: CREAM_DIM }}>
                A coordination market for ideas on Solana. I read live market data and hand you
                links to sign in your own wallet — I never hold keys.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
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
            </div>
          )}

          {messages.map((m) => {
            const text = messageText(m.parts as { type: string; text?: string }[]);
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    isUser
                      ? { background: 'rgba(232,150,96,0.14)', color: CREAM }
                      : { background: 'rgba(244,238,228,0.05)', color: CREAM }
                  }
                >
                  {text ? (
                    <Linkified text={text} />
                  ) : usedTools(m.parts as { type: string }[]) ? (
                    <span style={{ color: CREAM_FAINT }}>Looking at live markets…</span>
                  ) : (
                    <span style={{ color: CREAM_FAINT }}>…</span>
                  )}
                </div>
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

      <div className="border-t px-4 py-4 sm:px-6" style={{ borderColor: HAIR }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2"
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
            placeholder="Ask about a market, a category, or how PNL works…"
            className="flex-1 resize-none rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-50"
            style={{ borderColor: HAIR, color: CREAM }}
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(244,238,228,0.10)', color: CREAM }}
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-30"
              style={{ background: AMBER, color: '#1a1208' }}
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px]" style={{ color: CREAM_FAINT }}>
          The concierge reads public market data and never signs transactions or holds funds.
        </p>
      </div>
    </div>
  );
}
