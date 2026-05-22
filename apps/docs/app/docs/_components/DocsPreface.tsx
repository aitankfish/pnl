import Link from 'next/link';

// ─── Book-preface chapter row ──────────────────────────────────────────
// Title on the left, dotted leader, reading time on the right.
// The leader uses a CSS background-image pattern — more precise than the
// classic flex+overflow:hidden hack, and the dots stay crisp at any zoom.
function ChapterRow({
  number,
  title,
  blurb,
  time,
  href,
}: {
  number: string;
  title: string;
  blurb: string;
  time: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block py-5 sm:py-6
                 border-b border-pnl-night/10 dark:border-pnl-cream/10
                 transition-colors hover:bg-[#e89660]/5 dark:hover:bg-[#e89660]/8"
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4">
        <span
          className="font-mono text-[0.6875rem] uppercase tracking-[0.28em]
                     text-pnl-night/55 dark:text-pnl-cream/55
                     group-hover:text-[#e89660] transition-colors
                     w-10 sm:w-14"
        >
          {number}
        </span>
        <span
          className="relative font-serif text-xl sm:text-2xl leading-snug
                     text-pnl-night dark:text-pnl-cream
                     after:absolute after:left-0 after:right-0 after:bottom-[0.35em]
                     after:h-[0.85em] after:bg-[length:6px_1px] after:bg-repeat-x
                     after:bg-[position:0_100%]
                     after:bg-[radial-gradient(circle_at_center,_rgba(10,8,20,0.25)_1px,_transparent_1px)]
                     dark:after:bg-[radial-gradient(circle_at_center,_rgba(244,238,228,0.22)_1px,_transparent_1px)]
                     after:-z-10"
        >
          <span className="bg-pnl-cream dark:bg-pnl-night pe-3 relative z-10">
            {title}
          </span>
        </span>
        <span
          className="font-mono text-[0.6875rem] uppercase tracking-[0.22em]
                     text-pnl-night/55 dark:text-pnl-cream/55
                     bg-pnl-cream dark:bg-pnl-night ps-3 relative z-10
                     whitespace-nowrap"
        >
          {time}
        </span>
      </div>
      <p
        className="mt-2 ml-10 sm:ml-14 font-serif text-base leading-relaxed
                   text-pnl-night/70 dark:text-pnl-cream/70
                   max-w-prose"
      >
        {blurb}
      </p>
    </Link>
  );
}

// ─── Top-level book preface ────────────────────────────────────────────
export default function DocsPreface() {
  return (
    <article
      className="mx-auto w-full max-w-[720px] px-2 sm:px-6
                 pt-6 sm:pt-12 pb-24
                 text-pnl-night dark:text-pnl-cream
                 font-sans"
    >
      {/* ════ Frontispiece ════ */}
      <header className="mb-16 sm:mb-20 text-center">
        <h1
          className="font-serif font-light leading-[0.95] tracking-[-0.02em]
                     text-[clamp(2.5rem,7vw,4.5rem)]"
          style={{ fontFeatureSettings: '"ss01"' }}
        >
          Documentation
        </h1>
        <p
          className="mt-6 font-mono uppercase text-[0.625rem] tracking-[0.32em]
                     text-pnl-night/55 dark:text-pnl-cream/55"
        >
          Edition 001 · May 2026
        </p>
        <div
          className="mt-10 mx-auto h-px w-16
                     bg-pnl-night/25 dark:bg-pnl-cream/25"
        />
      </header>

      {/* ════ Preface ════ */}
      <section className="mb-20 sm:mb-24">
        <p
          className="font-mono uppercase text-[0.625rem] tracking-[0.32em]
                     text-pnl-night/55 dark:text-pnl-cream/55 mb-6"
        >
          Preface
        </p>

        <p
          className="font-serif text-lg sm:text-xl leading-[1.7]
                     text-pnl-night dark:text-pnl-cream first-letter:text-5xl
                     first-letter:font-light first-letter:float-left
                     first-letter:mr-2 first-letter:mt-1
                     first-letter:leading-[0.85]
                     first-letter:text-[#e89660]"
        >
          This document describes a protocol that does not yet exist at scale.
          P&L is a conviction-market launchpad on Solana mainnet — anyone posts
          an idea, believers and critics stake SOL on whether it deserves to
          exist, and the winning side takes the pool. When YES wins, the idea
          graduates into a token. When NO wins, critics are paid for filtering
          noise. The protocol is live, the source is open, and the economics
          are public. What does not yet exist at scale is the workflow we are
          building it for: AI agents and the developers who work alongside
          them, surfacing ideas in volumes the old funding paths were never
          designed to filter.
        </p>

        <p
          className="mt-6 font-serif text-lg sm:text-xl leading-[1.7]
                     text-pnl-night/85 dark:text-pnl-cream/85"
        >
          Read this document in order. Each chapter is short enough to read in
          one sitting, and together they explain the protocol completely — the
          mechanics, the economics, the integration surfaces, the regulatory
          posture, the limitations we have not yet fixed. There is no
          implicit knowledge. If you finish all six chapters you will know as
          much about the operating reality of P&L as anyone inside the team.
        </p>

        <p
          className="mt-6 font-serif text-lg sm:text-xl leading-[1.7]
                     text-pnl-night/85 dark:text-pnl-cream/85"
        >
          If you have ten minutes, read{' '}
          <Link
            href="/docs/manifesto"
            className="underline decoration-[#e89660]/40 underline-offset-4
                       decoration-[1.5px] hover:decoration-[#e89660]
                       transition-colors"
          >
            the manifesto
          </Link>
          {' '}— it stakes the thesis behind why this exists.
          If you want to start writing code, jump to the{' '}
          <Link
            href="/docs/build/quickstart"
            className="underline decoration-[#e89660]/40 underline-offset-4
                       decoration-[1.5px] hover:decoration-[#e89660]
                       transition-colors"
          >
            quickstart
          </Link>
          {' '}— working transactions in five minutes, no SDK required.
        </p>
      </section>

      {/* ════ Table of Contents ════ */}
      <section className="mb-20 sm:mb-24">
        <p
          className="font-mono uppercase text-[0.625rem] tracking-[0.32em]
                     text-pnl-night/55 dark:text-pnl-cream/55 mb-8"
        >
          Table of Contents
        </p>

        <div className="border-t border-pnl-night/10 dark:border-pnl-cream/10">
          <ChapterRow
            number="§ I"
            title="Manifesto"
            time="12 min"
            href="/docs/manifesto"
            blurb="The thesis behind the protocol — why the AI-builder wave needs a different kind of launchpad, and why less friction was the wrong answer."
          />
          <ChapterRow
            number="§ II"
            title="How to buy"
            time="5 min"
            href="/docs/how-to-buy"
            blurb="Phantom wallet, SOL, and your first stake. The on-ramp for non-crypto-native readers."
          />
          <ChapterRow
            number="§ III"
            title="How PNL works"
            time="18 min"
            href="/docs/mechanics/overview"
            blurb="The conviction-market mechanic, the lifecycle from planted idea to bloomed token, and the math that decides what graduates."
          />
          <ChapterRow
            number="§ IV"
            title="For builders & agents"
            time="24 min"
            href="/docs/build/quickstart"
            blurb="Working transactions in 5 minutes. Architecture, on-chain program reference, public read API, agent integration via MCP."
          />
          <ChapterRow
            number="§ V"
            title="Transparency"
            time="8 min"
            href="/docs/transparency"
            blurb="Where every fee goes. The regulatory posture. The limitations we haven't fixed yet. Every privileged wallet on the protocol."
          />
          <ChapterRow
            number="§ VI"
            title="Legal"
            time="3 min"
            href="/docs/legal/privacy"
            blurb="Privacy policy, terms of service, risk disclaimer. Read before staking real money."
          />
        </div>

        <div
          className="mt-8 grid grid-cols-[auto_1fr_auto] items-baseline gap-4
                     font-mono uppercase text-[0.6875rem] tracking-[0.22em]
                     text-pnl-night/45 dark:text-pnl-cream/45"
        >
          <span className="w-10 sm:w-14">Total</span>
          <span className="opacity-50">·····</span>
          <span>~70 min</span>
        </div>
      </section>

      {/* ════ Errata ════ */}
      <section className="mb-16">
        <p
          className="font-mono uppercase text-[0.625rem] tracking-[0.32em]
                     text-pnl-night/55 dark:text-pnl-cream/55 mb-4"
        >
          Errata & corrections
        </p>
        <p
          className="font-serif text-base leading-relaxed
                     text-pnl-night/85 dark:text-pnl-cream/85"
        >
          This document is live. When the on-chain protocol disagrees with the
          text below, the protocol wins. The source code at{' '}
          <Link
            href="https://github.com/aitankfish/pnl"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[#e89660]/40 underline-offset-4
                       decoration-[1.5px] hover:decoration-[#e89660]
                       transition-colors"
          >
            github.com/aitankfish/pnl
          </Link>
          {' '}is the ground truth; this documentation is its narrative.
          If you find a discrepancy or a wrong claim, open an issue and we
          will fix it.
        </p>
      </section>

      {/* ════ Colophon ════ */}
      <footer
        className="pt-8 border-t border-pnl-night/10 dark:border-pnl-cream/10
                   font-mono text-[0.625rem] uppercase tracking-[0.28em]
                   text-pnl-night/45 dark:text-pnl-cream/45
                   flex flex-col sm:flex-row gap-3 sm:gap-8"
      >
        <span>Edition 001 · MIT license</span>
        <span className="sm:ms-auto">
          <Link
            href="https://github.com/aitankfish/pnl"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#e89660] transition-colors"
          >
            github.com/aitankfish/pnl
          </Link>
        </span>
      </footer>
    </article>
  );
}
