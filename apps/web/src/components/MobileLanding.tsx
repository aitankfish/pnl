'use client';

import Link from 'next/link';

// Mobile-native landing page (viewport < 768px) for pnl.market.
//
// The desktop landing is a 2,400-line scroll-driven story with a cosmic
// 3D tree, sticky chapter companion, and multiple framer-motion sections.
// On phones the 3D scene crashes mid-render (50+ TubeGeometry tubes +
// chromatic-aberration post-pass exceeds phone-GPU memory) and the
// scroll story is unusably heavy. This page replaces the whole thing on
// phones: static tree-mark hero, two clear actions (Enter markets /
// Pitch an idea), a manifesto-tone pull-quote, and a proof strip.
//
// Mirrors the docs.pnl.market mobile pattern so a user who's seen one
// recognises the other.

export default function MobileLanding() {
  return (
    <main
      className="relative min-h-[100dvh] w-full overflow-hidden
                 bg-[#0a0814] text-[#f4eee4]
                 flex flex-col"
    >
      {/* Soft cosmic vignette — pure CSS, no GPU expense. Mimics the
          deep-night atmosphere of the desktop hero. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 18%, rgba(232,150,96,0.18) 0%, rgba(232,150,96,0.06) 28%, transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(63,122,66,0.14) 0%, transparent 50%)',
        }}
      />

      {/* Grain — saves the flat black from feeling sterile */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      {/* Top strip — bare. Single tree mark, no wordmark. */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-6 pb-2">
        <TreeMarkSmall />
        <Link
          href="https://docs.pnl.market"
          className="mono text-[0.6rem] uppercase tracking-[0.22em]
                     text-[#8a7f72] hover:text-[#ecb48a] transition-colors"
        >
          Docs
        </Link>
      </header>

      {/* Hero block — centered, ~30% from top. */}
      <section className="relative z-10 flex-1 flex flex-col justify-center px-6 pb-8">
        <div className="flex justify-center mb-6">
          <TreeMarkLarge />
        </div>

        <h1
          className="serif text-center text-[2.3rem] leading-[1.05] tracking-[-0.02em] text-[#f4eee4]"
        >
          Plant the idea.
        </h1>
        <p
          className="serif text-center italic text-[1.5rem] leading-[1.1] mt-1
                     text-transparent bg-clip-text"
          style={{
            backgroundImage:
              'linear-gradient(178deg, #fff2d8 0%, #ecb48a 30%, #d99875 65%, #d67347 100%)',
          }}
        >
          Watch it grow.
        </p>

        {/* The mechanism, in plain words. This used to read "PNL is a conviction
            market … what wins gets tokenized" — every load-bearing term in that
            sentence ("conviction market", "tokenized") is jargon to someone who has
            never touched Solana, which is exactly who lands here from a hackathon.
            Say what happens instead of naming the category. */}
        <p className="mt-6 text-center text-[0.95rem] leading-[1.55] text-[#c8bdb0] max-w-[34ch] mx-auto">
          Post a project. Believers stake YES, critics stake NO.
          If YES wins it launches a token. If NO wins, the critics get paid.
        </p>

        {/* Pull-quote — keeps the book voice, but now carries the differentiator
            instead of restating the metaphor. This is the one line no launchpad
            and no prediction market can claim. */}
        <figure className="mt-9 mx-auto max-w-[36ch]">
          <div
            aria-hidden
            className="mx-auto h-px w-12 mb-5"
            style={{ background: 'linear-gradient(to right, transparent, #e89660, transparent)' }}
          />
          <blockquote
            className="serif text-center text-[0.95rem] leading-[1.6] italic text-[#ecb48a]"
          >
            &ldquo;Nowhere else pays you to say no.&rdquo;
          </blockquote>
        </figure>
      </section>

      {/* CTA stack — the two actions a mobile visitor actually wants:
          enter the markets, or pitch their own. */}
      <section className="relative z-10 px-5 pb-6">
        <div className="flex flex-col gap-3 max-w-[32rem] mx-auto">
          <Link
            href="/browse"
            className="w-full inline-flex items-center justify-center gap-3
                       px-5 py-4 mono text-[0.72rem] uppercase tracking-[0.22em]
                       text-[#0a0814] bg-[#e89660] active:bg-[#ecb48a]
                       border border-[#e89660]
                       transition-colors"
          >
            {/* "no wallet" is the highest-value four words on this screen. A cold
                visitor's first question is whether looking around will cost them
                something or demand a signature. Answer it on the button. */}
            <span>Browse ideas &mdash; no wallet</span>
            <ArrowRight />
          </Link>

          <Link
            href="/create"
            className="w-full inline-flex items-center justify-center gap-3
                       px-5 py-4 mono text-[0.72rem] uppercase tracking-[0.22em]
                       text-[#ecb48a] active:text-[#fff5e1]
                       border border-[rgba(232,150,96,0.4)] active:border-[rgba(232,150,96,0.9)]
                       bg-[rgba(10,8,20,0.5)] active:bg-[rgba(10,8,20,0.8)]
                       transition-colors"
          >
            <SproutGlyph />
            <span>Post your project</span>
          </Link>
        </div>
      </section>

      {/* Proof strip — mainnet pulse + truncated pubkeys + secondary links.
          Same shape as docs.pnl.market so the visual rhythm matches. */}
      <footer className="relative z-10 border-t border-[rgba(232,150,96,0.15)] px-5 py-5">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Pulse />
          <span className="mono text-[0.6rem] uppercase tracking-[0.22em] text-[#3f7a42]">
            Live on Solana mainnet
          </span>
        </div>
        <div className="flex flex-col gap-1.5 max-w-[32rem] mx-auto">
          <ProofRow label="$PNL" value="6QuNZJ…pump" />
          <ProofRow label="Program" value="C5mVE2…Vj86" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-5 mono text-[0.6rem] uppercase tracking-[0.22em] text-[#8a7f72]">
          {/* How to buy collapsed into Docs — see apps/web/HIDDEN_ROUTES.md */}
          <Link href="https://docs.pnl.market" className="hover:text-[#ecb48a] transition-colors">
            Docs
          </Link>
          <span aria-hidden className="text-[#3a3530]">·</span>
          <Link href="/launched" className="hover:text-[#ecb48a] transition-colors">
            Launched
          </Link>
          <span aria-hidden className="text-[#3a3530]">·</span>
          <Link href="https://github.com/aitankfish/pnl" className="hover:text-[#ecb48a] transition-colors">
            GitHub
          </Link>
        </div>
      </footer>
    </main>
  );
}

// ─── Visual atoms ─────────────────────────────────────────────────

function TreeMarkSmall() {
  return (
    <span className="inline-flex items-center justify-center text-[#e89660]">
      <TreeSvg size={22} stroke={1.5} />
    </span>
  );
}

function TreeMarkLarge() {
  return (
    <div className="relative w-[120px] h-[120px] flex items-center justify-center">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 70%, rgba(232,150,96,0.35) 0%, rgba(232,150,96,0.08) 40%, transparent 70%)',
          filter: 'blur(2px)',
        }}
      />
      <span className="relative inline-flex items-center justify-center text-[#e89660]">
        <TreeSvg size={96} stroke={1.4} />
      </span>
    </div>
  );
}

function TreeSvg({ size, stroke }: { size: number; stroke: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3c-3.6 0-6.2 2.5-6.2 5.7 0 1.3.5 2.5 1.4 3.4-1.4.5-2.3 1.6-2.3 2.9 0 1.7 1.6 2.9 3.7 2.9h7c2.1 0 3.6-1.2 3.6-2.9 0-1.3-.9-2.4-2.3-2.9.9-.9 1.4-2.1 1.4-3.4C18.3 5.5 15.6 3 12 3Z" />
      <path d="M12 18.9V22" />
      <path d="M9.8 22h4.4" />
    </svg>
  );
}

function ArrowRight() {
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
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}

function SproutGlyph() {
  // Small sprout — pairs with "Pitch an idea" to signal something being planted.
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
      <path d="M12 20v-7" />
      <path d="M12 13c0-3 2-5 5-5-.5 3-2.5 5-5 5Z" />
      <path d="M12 13c0-3-2-5-5-5 .5 3 2.5 5 5 5Z" />
    </svg>
  );
}

function Pulse() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#3f7a42] opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3f7a42]" />
    </span>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between mono text-[0.62rem] uppercase tracking-[0.18em]">
      <span className="text-[#8a7f72]">{label}</span>
      <span className="text-[#ecb48a]">{value}</span>
    </div>
  );
}
