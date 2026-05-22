'use client';

import Link from 'next/link';
import AiCopyButton from './AiCopyButton';

// Mobile-native landing page (viewport < 768px).
//
// No 3D Canvas, no WebGL, no chromatic-aberration post-pass — the desktop
// cosmic-tree scene crashes mid-phone-GPU. The mobile experience is its
// own thing: a still tree-mark hero, a pull-quote from the manifesto, two
// clear ways forward (read the docs / copy a prompt into your AI tool),
// and an on-chain proof strip so the protocol feels alive without
// rendering a 3D world for it.

export default function MobileHero() {
  return (
    <main
      className="relative min-h-[100dvh] w-full overflow-hidden
                 bg-[#0a0814] text-[#f4eee4]
                 flex flex-col"
    >
      {/* Soft cosmic vignette — pure CSS, no GPU expense. Mimics the
          deep-night atmosphere of the desktop scene without rendering it. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 18%, rgba(232,150,96,0.18) 0%, rgba(232,150,96,0.06) 28%, transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(63,122,66,0.14) 0%, transparent 50%)',
        }}
      />

      {/* Grain texture — gives the flat black background some breath */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      {/* Top strip — bare. Single tree mark, no wordmark. */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-6 pb-2">
        <TreeMarkSmall />
        <Link
          href="https://pnl.market"
          className="text-[0.6rem] font-mono uppercase tracking-[0.22em]
                     text-[#8a7f72] hover:text-[#ecb48a] transition-colors"
        >
          Live site
        </Link>
      </header>

      {/* Hero block — sits ~30% from top, centered. */}
      <section className="relative z-10 flex-1 flex flex-col justify-center px-6 pb-8">
        <div className="flex justify-center mb-6">
          <TreeMarkLarge />
        </div>

        <h1
          className="text-center text-[2.1rem] leading-[1.08] tracking-[-0.018em]
                     text-[#f4eee4]"
          style={{ fontFamily: 'var(--font-fraunces, Fraunces), serif' }}
        >
          Ideas <em className="not-italic text-[#e89660]">planted</em>
          <br />
          on&#8209;chain.
        </h1>

        <p className="mt-5 text-center text-[0.95rem] leading-[1.55] text-[#c8bdb0] max-w-[34ch] mx-auto">
          PNL turns a thought into a conviction market.
          The community stakes YES or NO.
          What wins becomes a token.
        </p>

        {/* Pull-quote — italic Fraunces, from the manifesto */}
        <figure className="mt-9 mx-auto max-w-[36ch]">
          <div
            aria-hidden
            className="mx-auto h-px w-12 mb-5"
            style={{ background: 'linear-gradient(to right, transparent, #e89660, transparent)' }}
          />
          <blockquote
            className="text-center text-[0.95rem] leading-[1.6] italic text-[#ecb48a]"
            style={{ fontFamily: 'var(--font-fraunces, Fraunces), serif' }}
          >
            &ldquo;The next decade of ideas will be born in agent windows.
            PNL is the protocol that catches them
            before they die in <span className="not-italic font-mono text-[0.78rem] text-[#c8bdb0]">// TODO</span> comments.&rdquo;
          </blockquote>
        </figure>
      </section>

      {/* CTA stack — primary action (read docs) is the affordance; the AI
          copy button is the secondary path for users who'd rather hand
          off to their agent than read directly. */}
      <section className="relative z-10 px-5 pb-6">
        <div className="flex flex-col gap-3 max-w-[32rem] mx-auto">
          <Link
            href="/docs"
            className="w-full inline-flex items-center justify-center gap-3
                       px-5 py-4 text-[0.72rem] font-mono uppercase tracking-[0.22em]
                       text-[#0a0814] bg-[#e89660] active:bg-[#ecb48a]
                       border border-[#e89660]
                       transition-colors"
          >
            <span>Read the docs</span>
            <ArrowRight />
          </Link>

          <AiCopyButton variant="inline" />
        </div>
      </section>

      {/* Proof strip — mainnet badges + mono pubkeys. Reassures the visitor
          that this is a real protocol with verifiable on-chain artifacts,
          without dragging them into a 3D scene to prove it. */}
      <footer className="relative z-10 border-t border-[rgba(232,150,96,0.15)] px-5 py-5">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Pulse />
          <span className="text-[0.6rem] font-mono uppercase tracking-[0.22em] text-[#3f7a42]">
            Live on Solana mainnet
          </span>
        </div>
        <div className="flex flex-col gap-1.5 max-w-[32rem] mx-auto">
          <ProofRow label="Program" value="C5mVE2…Vj86" />
          <ProofRow label="$PNL" value="6QuNZJ…pump" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-5 text-[0.6rem] font-mono uppercase tracking-[0.22em] text-[#8a7f72]">
          <Link href="https://github.com/aitankfish/pnl" className="hover:text-[#ecb48a] transition-colors">
            GitHub
          </Link>
          <span aria-hidden className="text-[#3a3530]">·</span>
          <Link href="/docs/manifesto" className="hover:text-[#ecb48a] transition-colors">
            Manifesto
          </Link>
          <span aria-hidden className="text-[#3a3530]">·</span>
          <Link href="/docs/build/quickstart" className="hover:text-[#ecb48a] transition-colors">
            Build
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
  // Hero-size tree, with a soft warm glow underneath that hints at the
  // sun/seed without rendering anything dynamic.
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

function Pulse() {
  // Pure CSS dot + ring pulse — no JS clock, no useFrame, cheap on phones.
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#3f7a42] opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3f7a42]" />
    </span>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[0.62rem] font-mono uppercase tracking-[0.18em]">
      <span className="text-[#8a7f72]">{label}</span>
      <span className="text-[#ecb48a]">{value}</span>
    </div>
  );
}
