/**
 * Whitepaper page.
 *
 * The brand's intellectual signature. Reads as a long-form journal entry
 * crossed with an annotated specification — editorial cosmic-plant
 * typography on top, interactive AMM simulator embedded mid-document.
 * Every claim and data point preserved verbatim from the prior version;
 * visual treatment fully swapped to the cosmic-plant editorial system.
 */

import { Metadata } from 'next';
import AMMSimulator from '@/components/whitepaper/AMMSimulator';
import WhitepaperSidebar from '@/components/whitepaper/WhitepaperSidebar';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';

// ── Cosmic-plant palette (inline so the file is self-contained) ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

export const metadata: Metadata = {
  title: 'Whitepaper | PNL',
  description:
    'PNL (Predict & Launch) — Tokenizing ideas to fund builders and dreamers worldwide.',
  openGraph: {
    title: 'PNL Whitepaper',
    description:
      'Idea tokenization: where dreamers meet believers. Learn how PNL revolutionizes fundraising with conviction markets.',
    url: `${BASE_URL}/whitepaper`,
    siteName: 'PNL',
    images: [
      {
        url: `${BASE_URL}/api/og?title=PNL%20Whitepaper&description=Idea%20Tokenization%3A%20Where%20Dreamers%20Meet%20Believers`,
        width: 1200,
        height: 630,
        alt: 'PNL Whitepaper',
      },
    ],
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PNL Whitepaper',
    description:
      'Idea tokenization: where dreamers meet believers. Learn how PNL revolutionizes fundraising with conviction markets.',
    images: [
      `${BASE_URL}/api/og?title=PNL%20Whitepaper&description=Idea%20Tokenization%3A%20Where%20Dreamers%20Meet%20Believers`,
    ],
  },
};

// Editorial callout — used for any block of prose that wants its own breath
function Callout({
  eyebrow,
  accent = AMBER,
  children,
}: {
  eyebrow?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: `${accent}0d`,
        border: `1px solid ${accent}33`,
        padding: '1.25rem 1.5rem',
        margin: '1.5rem 0',
      }}
    >
      {eyebrow && (
        <p
          className="mono uppercase tracking-[0.3em] text-[0.55rem]"
          style={{ color: accent, marginBottom: '0.75rem' }}
        >
          {eyebrow}
        </p>
      )}
      {children}
    </div>
  );
}

// Numbered step tile (used in the lifecycle diagram + phase grid)
function StepTile({
  number,
  title,
  description,
  meta,
  accent = AMBER,
}: {
  number: number;
  title: string;
  description: string;
  meta?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
        padding: '1.25rem',
      }}
    >
      <div className="flex items-center gap-3 mb-2.5">
        <span
          className="mono"
          style={{
            width: '2rem',
            height: '2rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${accent}1a`,
            color: accent,
            border: `1px solid ${accent}55`,
            fontSize: '0.7rem',
            letterSpacing: '0.04em',
            fontFeatureSettings: '"tnum" on',
          }}
        >
          {String(number).padStart(2, '0')}
        </span>
        <h3
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontWeight: 400,
            fontSize: '1.05rem',
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      <p
        style={{
          color: CREAM_DIM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '0.88rem',
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {description}
      </p>
      {meta && (
        <p
          className="mono uppercase tracking-[0.22em] text-[0.55rem]"
          style={{ color: accent, marginTop: '0.6rem' }}
        >
          {meta}
        </p>
      )}
    </div>
  );
}

// Token distribution row (one of "Early supporters: 65%" rows)
function DistRow({
  label,
  pct,
  accent,
  detail,
}: {
  label: string;
  pct: string;
  accent: string;
  detail?: string;
}) {
  return (
    <div className="text-center">
      <p
        style={{
          color: accent,
          fontFamily: 'var(--font-fraunces, serif)',
          fontWeight: 350,
          fontSize: '2rem',
          margin: 0,
          fontFeatureSettings: '"tnum" on',
        }}
      >
        {pct}
      </p>
      <p
        className="mono uppercase tracking-[0.22em] text-[0.55rem]"
        style={{ color: CREAM_DIM, marginTop: '0.4rem' }}
      >
        {label}
      </p>
      {detail && (
        <p
          className="italic"
          style={{
            color: CREAM_FAINT,
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            fontSize: '0.7rem',
            marginTop: '0.2rem',
          }}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen" style={{ color: CREAM }}>
      <WhitepaperSidebar />

      <div className="space-y-8 px-4 sm:px-6 md:px-8 pt-6 pb-16 lg:pl-72">
        <div className="max-w-3xl mx-auto">
          {/* ─── Hero header ─── */}
          <header className="text-center mb-12 sm:mb-16">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
              style={{ color: AMBER }}
            >
              The case
            </p>
            <h1
              className="leading-[1.05] mb-3"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(2.4rem, 6vw, 4rem)',
                fontFeatureSettings: '"ss01"',
                letterSpacing: '-0.012em',
              }}
            >
              Whitepaper
            </h1>
            <p
              className="italic mx-auto max-w-md"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '1.1rem',
                lineHeight: 1.45,
              }}
            >
              Idea tokenization — where dreamers meet believers.
            </p>
            <p
              className="mono uppercase tracking-[0.26em] text-[0.55rem] mt-5"
              style={{ color: CREAM_FAINT }}
            >
              Version 1.0 · December 2025 · Solana mainnet
            </p>
          </header>

          {/* Mission anchor */}
          <Callout accent={AMBER}>
            <p
              className="text-center italic"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              "Fueling the world's brilliant ideas — from anywhere, for everyone."
            </p>
            <p
              className="text-center mono uppercase tracking-[0.32em] text-[0.55rem] mt-3"
              style={{ color: AMBER }}
            >
              Yours could be next.
            </p>
          </Callout>

          {/* ─── The thesis (opening chapter, lifted from landing) ───
              Five claims about why this work matters. Sits before the
              numbered § sections so the document opens with conviction
              and then descends into mechanics. Roman numerals echo the
              landing's treatment for cross-surface consistency. */}
          <section id="thesis" className="scroll-mt-28 mt-16 mb-16">
            <header className="mb-10">
              <p
                className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4 flex items-center gap-3"
                style={{ color: AMBER }}
              >
                <span className="inline-block w-8 h-px" style={{ background: AMBER }} />
                The thesis
                <span style={{ color: CREAM_FAINT }}>· five claims</span>
              </p>
              <h2
                className="leading-[1.02]"
                style={{
                  color: CREAM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontWeight: 350,
                  fontSize: 'clamp(1.9rem, 4.5vw, 3rem)',
                  fontFeatureSettings: '"ss01"',
                  letterSpacing: '-0.012em',
                  margin: 0,
                }}
              >
                What we&rsquo;re{' '}
                <em
                  style={{
                    fontStyle: 'italic',
                    fontVariationSettings: '"SOFT" 100, "WONK" 0, "opsz" 144',
                    color: PEACH,
                  }}
                >
                  really
                </em>{' '}
                building.
              </h2>
              <p
                className="italic mt-4 max-w-xl"
                style={{
                  color: CREAM_DIM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                  fontSize: '1.05rem',
                  lineHeight: 1.55,
                }}
              >
                &ldquo;VCs&rdquo; and &ldquo;fundraising&rdquo; are shorthand —
                easy words to make an unfamiliar idea land. The actual game is
                much bigger.
              </p>
            </header>

            <div className="flex flex-col gap-9">
              {[
                {
                  numeral: 'I',
                  headline: 'Ideas need a home before they need funding.',
                  body: 'Before a pitch deck, before a round, every company is a thought looking for its first listener. PNL is built for that earliest moment — when an idea is still fragile, still forming, still asking whether it belongs in the world.',
                },
                {
                  numeral: 'II',
                  headline: 'In the age of AI, human origination becomes sacred.',
                  body: 'As machines learn to execute, what remains uniquely ours is the spark itself — the intuition, the pattern only you saw. PNL is the digital gathering-ground where that origination can happen publicly, without gatekeepers.',
                },
                {
                  numeral: 'III',
                  headline: 'Conviction reveals what opinion hides.',
                  body: 'The internet runs on reactions; most of them free, most of them empty. Prediction markets turn reactions into commitments — and commitments show which ideas actually have weight behind them, not just attention.',
                },
                {
                  numeral: 'IV',
                  headline: 'Venture capital isn\u2019t wrong — just narrow.',
                  body: 'VCs optimize for patterns they can already recognize. A global market of believers and critics sees further — catching ideas from places no fund is flying to. PNL doesn\u2019t replace venture. It opens a door venture couldn\u2019t reach.',
                },
                {
                  numeral: 'V',
                  headline: 'Every pitched idea joins a library of human imagination.',
                  body: 'On-chain permanence means nothing fully dies. Ideas that didn\u2019t launch remain as signals — for the author to return to, for future builders to learn from. Over time, PNL accumulates as a record of humans attempting themselves.',
                },
              ].map((claim) => (
                <article
                  key={claim.numeral}
                  className="grid grid-cols-[auto_1fr] gap-5 sm:gap-7 items-baseline"
                >
                  <span
                    className="leading-none"
                    style={{
                      color: AMBER,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontWeight: 400,
                      fontSize: 'clamp(1.7rem, 3.5vw, 2.1rem)',
                      fontVariationSettings: '"SOFT" 30, "opsz" 72',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {claim.numeral}
                  </span>
                  <div className="flex flex-col gap-2.5">
                    <h3
                      className="leading-[1.2]"
                      style={{
                        color: CREAM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontWeight: 400,
                        fontSize: 'clamp(1.15rem, 2.4vw, 1.5rem)',
                        fontVariationSettings: '"SOFT" 50, "opsz" 48',
                        letterSpacing: '-0.012em',
                        margin: 0,
                      }}
                    >
                      {claim.headline}
                    </h3>
                    <p
                      style={{
                        color: CREAM_DIM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontSize: '1rem',
                        lineHeight: 1.65,
                        margin: 0,
                        maxWidth: '56ch',
                      }}
                    >
                      {claim.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div
              className="mt-12 pt-6 flex items-center gap-4"
              style={{ borderTop: `1px solid ${HAIR}` }}
            >
              <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
              <span
                className="mono uppercase tracking-[0.3em] text-[0.55rem]"
                style={{ color: CREAM_FAINT }}
              >
                Now — the mechanics
              </span>
              <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
            </div>
          </section>

          {/* Body — uses .editorial-doc styles for h2/p/ul/li/strong */}
          <div className="editorial-doc">
            {/* ─── Abstract ─── */}
            <section id="abstract" className="scroll-mt-28">
              <h2>§ 01 — Abstract</h2>
              <p>
                <strong>Traditional funding isn't accessible to everyone.</strong>{' '}
                The traditional path to capital requires connections, geography,
                and credentials that most brilliant minds simply don't have.
                Every day, world-changing ideas die — not because they lack
                merit, but because their creators lack access.
              </p>
              <p>
                <strong>PNL changes that.</strong> Through{' '}
                <em>idea tokenization</em>, builders can transform their vision
                into something the world can fund. Supporters back ideas they
                believe in and receive tokens in return — becoming early
                stakeholders in projects they helped make real. Builders get
                the capital they need to keep building. <strong>Everyone wins.</strong>
              </p>
              <p>
                The community validates through conviction markets — ensuring
                only ideas with real believers get funded. No gatekeepers. No
                rejections. No knowing the right people.{' '}
                <strong>
                  Just merit, vision, and a global crowd ready to believe in
                  the next big thing.
                </strong>
              </p>

              <Callout accent={FOREST} eyebrow="What it offers">
                <ul style={{ margin: 0 }}>
                  <li>
                    <strong>For builders.</strong> Raise capital from believers
                    worldwide — no gatekeepers required.
                  </li>
                  <li>
                    <strong>For supporters.</strong> Fund ideas you believe in,
                    receive tokens in return.
                  </li>
                  <li>
                    <strong>Community-validated.</strong> Conviction markets
                    filter quality, believers back winners.
                  </li>
                  <li>
                    <strong>Global &amp; permissionless.</strong> From anywhere,
                    for everyone — 0.01 SOL minimum.
                  </li>
                  <li>
                    <strong>Discover treasures.</strong> Find the next
                    breakthrough before the world does.
                  </li>
                </ul>
              </Callout>
            </section>

            {/* ─── The problem ─── */}
            <section id="problem" className="scroll-mt-28">
              <h2>§ 02 — The problem · capital is gatekept</h2>
              <p>
                You have a brilliant idea. You've done the research, built the
                prototype, and you know it can change the world. But you need
                capital to make it real. What are your options?
              </p>
              <p>
                <strong style={{ color: EARTH }}>
                  Gatekeepers won't return your emails.
                </strong>{' '}
                They fund Stanford dropouts and YC alumni — not dreamers in
                Lagos, Manila, or São Paulo. Less than 1% of startups get
                funded, and it's rarely about merit. It's about who you know,
                where you went to school, and which zip code you live in.{' '}
                <strong>The system is broken.</strong>
              </p>

              <div
                className="grid grid-cols-1 md:grid-cols-3 gap-3 my-6"
                style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}
              >
                {[
                  {
                    title: 'Traditional gatekeeping',
                    body: 'Connections over merit. Geography over vision. Credentials over capability.',
                  },
                  {
                    title: 'No global access',
                    body: 'Brilliant builders worldwide locked out of capital that flows freely in Silicon Valley.',
                  },
                  {
                    title: 'Ideas die daily',
                    body: 'World-changing visions fade — not for lack of merit, but lack of access.',
                  },
                ].map((b) => (
                  <div
                    key={b.title}
                    style={{
                      background: `${EARTH}0d`,
                      border: `1px solid ${EARTH}33`,
                      padding: '1rem 1.1rem',
                    }}
                  >
                    <p
                      className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                      style={{ color: EARTH, marginBottom: '0.5rem' }}
                    >
                      {b.title}
                    </p>
                    <p
                      style={{
                        color: CREAM_DIM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontSize: '0.85rem',
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {b.body}
                    </p>
                  </div>
                ))}
              </div>

              <Callout accent={AMBER} eyebrow="The opening">
                <p style={{ margin: 0, color: CREAM_DIM }}>
                  <strong>Web3 offered hope.</strong> Peer-to-peer funding
                  without intermediaries. But there was a missing piece — what
                  do supporters get in return? Donations alone don't scale.
                  People need skin in the game, a reason to believe{' '}
                  <em>and</em> benefit.
                </p>
                <p
                  style={{
                    margin: '0.75rem 0 0 0',
                    color: CREAM,
                    fontWeight: 500,
                  }}
                >
                  The answer? Tokenize the idea. Give supporters ownership. Let
                  the crowd become co-founders.
                </p>
              </Callout>
            </section>

            {/* ─── The solution ─── */}
            <section id="solution" className="scroll-mt-28">
              <h2>§ 03 — The solution · idea tokenization</h2>

              <Callout accent={AMBER} eyebrow="Core insight">
                <p style={{ margin: 0, color: CREAM_DIM }}>
                  Conviction markets let people put real money behind ideas
                  they believe in — creating the most powerful signal of
                  genuine belief ever designed.{' '}
                  <strong>
                    PNL harnesses this collective intelligence to separate
                    brilliant ideas from noise.
                  </strong>
                </p>
                <p
                  style={{
                    margin: '0.75rem 0 0 0',
                    color: CREAM_DIM,
                  }}
                >
                  When real money is on the line, people do their homework.{' '}
                  <strong style={{ color: EARTH }}>Critics</strong> are
                  incentivized to find flaws, while{' '}
                  <strong style={{ color: FOREST }}>early supporters</strong>{' '}
                  are rewarded for spotting winners before anyone else.
                </p>
              </Callout>

              <h3>How idea tokenization works</h3>
              <ol>
                <li>
                  <strong>Founder tokenizes their idea.</strong> Create a
                  market for your vision.
                </li>
                <li>
                  <strong>Community evaluates.</strong> Early supporters back
                  it, critics challenge it.
                </li>
                <li>
                  <strong>Price discovery.</strong> The market reveals true
                  sentiment.
                </li>
                <li>
                  <strong>Validation gate.</strong> Only ideas with majority
                  support get tokenized.
                </li>
                <li>
                  <strong>Presale rewards.</strong> Early supporters receive
                  65% of tokens at launch.
                </li>
              </ol>
              <p
                className="italic"
                style={{
                  color: FOREST,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                }}
              >
                Result — the world's best ideas rise to the top. Real treasures
                get discovered.
              </p>
            </section>

            {/* ─── How PNL works ─── */}
            <section id="how-it-works" className="scroll-mt-28">
              <h2>§ 04 — How it works</h2>

              <Callout accent={AMBER} eyebrow="The journey">
                <p
                  className="text-center"
                  style={{
                    margin: '0 0 1.25rem 0',
                    color: CREAM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '1.05rem',
                    fontStyle: 'italic',
                  }}
                >
                  Every great project starts with a vision. Here's how PNL
                  turns yours into reality.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StepTile
                    number={1}
                    title="Create"
                    description="Founder tokenizes their idea"
                    meta="0.015 SOL"
                    accent={AMBER}
                  />
                  <StepTile
                    number={2}
                    title="Validate"
                    description="Community backs or challenges"
                    meta="Min 0.01 SOL"
                    accent={PEACH}
                  />
                  <StepTile
                    number={3}
                    title="Resolve"
                    description="Market decides outcome"
                    meta="At expiry"
                    accent={FOREST}
                  />
                  <StepTile
                    number={4}
                    title="Launch"
                    description="Token goes live on Pump.fun"
                    meta="If YES wins"
                    accent={AMBER}
                  />
                </div>

                <p
                  className="text-center italic mt-5"
                  style={{
                    color: CREAM_FAINT,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontStyle: 'italic',
                    fontSize: '0.78rem',
                    margin: '1.25rem 0 0.75rem 0',
                  }}
                >
                  Three possible outcomes — each one fair.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    {
                      title: 'YES wins',
                      body: 'Token launches → early supporters get 65%',
                      color: FOREST,
                    },
                    {
                      title: 'NO wins',
                      body: 'No launch → critics share 95% of pool',
                      color: EARTH,
                    },
                    {
                      title: 'Tie / under target',
                      body: 'Everyone gets a 98.5% refund',
                      color: PEACH,
                    },
                  ].map((o) => (
                    <div
                      key={o.title}
                      style={{
                        background: `${o.color}0d`,
                        border: `1px solid ${o.color}44`,
                        padding: '0.85rem',
                      }}
                    >
                      <p
                        className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                        style={{ color: o.color, margin: '0 0 0.25rem 0' }}
                      >
                        {o.title}
                      </p>
                      <p
                        style={{
                          color: CREAM_DIM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontSize: '0.78rem',
                          margin: 0,
                        }}
                      >
                        {o.body}
                      </p>
                    </div>
                  ))}
                </div>
              </Callout>

              <p>
                Let's break down each phase. The process is simple, transparent,
                and designed to reward conviction.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-6">
                <StepTile
                  number={1}
                  title="Create"
                  description="Founder submits their idea with project details, token economics, and target pool size."
                  meta="Cost · 0.015 SOL"
                  accent={AMBER}
                />
                <StepTile
                  number={2}
                  title="Validate"
                  description="Community votes YES or NO. Early supporters back winners, critics filter quality."
                  meta="Min 0.01 SOL · 1.5% fee"
                  accent={PEACH}
                />
                <StepTile
                  number={3}
                  title="Resolve"
                  description="At expiry, shares are counted. More YES shares = launch. More NO shares = critics win."
                  meta="Completion fee · 5%"
                  accent={FOREST}
                />
                <StepTile
                  number={4}
                  title="Launch"
                  description="If YES wins, token launches atomically on Pump.fun. Early supporters get 65% of tokens."
                  meta="Up to 50 SOL → Pump.fun"
                  accent={AMBER}
                />
              </div>

              <p
                className="italic text-center"
                style={{
                  color: CREAM_FAINT,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                  marginTop: '1.5rem',
                }}
              >
                When the community says YES, tokens are distributed fairly — no
                insiders, no gatekeepers, just believers.
              </p>
              <div
                style={{
                  background: 'rgba(244,238,228,0.025)',
                  border: `1px solid ${HAIR_STRONG}`,
                  padding: '1.5rem',
                  marginTop: '1rem',
                }}
              >
                <p
                  className="mono uppercase tracking-[0.3em] text-[0.55rem] text-center"
                  style={{ color: AMBER, marginBottom: '1.25rem' }}
                >
                  Token distribution
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <DistRow
                    label="Early supporters"
                    pct="65%"
                    accent={FOREST}
                  />
                  <DistRow
                    label="Founder"
                    pct="33%"
                    accent={AMBER}
                    detail="vested"
                  />
                  <DistRow label="Platform" pct="2%" accent={PEACH} />
                </div>
              </div>
            </section>

            {/* ─── Why build & invest ─── */}
            <section id="benefits" className="scroll-mt-28">
              <h2>§ 05 — Why build &amp; invest on PNL</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
                {[
                  {
                    eyebrow: 'For founders & dreamers',
                    accent: AMBER,
                    tagline: 'Turn your vision into reality',
                    points: [
                      ['Global capital', 'Raise from believers worldwide'],
                      ['Instant community', 'Early supporters become your first fans'],
                      ['Validation', 'Know your idea has market demand'],
                      ['Fair deal', 'Keep your equity, share tokens'],
                      ['Fast launch', 'Go from idea to token in days'],
                    ],
                  },
                  {
                    eyebrow: 'For early supporters',
                    accent: FOREST,
                    tagline: 'Find treasures before the crowd',
                    points: [
                      ['Presale access', 'Get tokens at ground floor'],
                      ['Due diligence pays', 'Research → spot winners → profit'],
                      ['65% allocation', 'Majority of tokens go to believers'],
                      ['Direct connection', 'Build relationships with founders'],
                      ['Shape the future', 'Back ideas you believe in'],
                    ],
                  },
                  {
                    eyebrow: 'For critics',
                    accent: EARTH,
                    tagline: 'Get paid to filter quality',
                    points: [
                      ['Quality control', 'Your skepticism protects the ecosystem'],
                      ['Earn from flops', 'When bad ideas fail, critics profit'],
                      ['Balance the market', 'Keep hype in check'],
                      ['Protect others', 'Your NO vote warns the community'],
                      ['95% pool share', 'Winners split the pot'],
                    ],
                  },
                ].map((g) => (
                  <div
                    key={g.eyebrow}
                    style={{
                      background: `${g.accent}0a`,
                      border: `1px solid ${g.accent}33`,
                      padding: '1.25rem 1.25rem',
                    }}
                  >
                    <p
                      className="mono uppercase tracking-[0.26em] text-[0.55rem]"
                      style={{ color: g.accent, marginBottom: '0.4rem' }}
                    >
                      {g.eyebrow}
                    </p>
                    <p
                      className="italic"
                      style={{
                        color: CREAM_DIM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontStyle: 'italic',
                        fontSize: '0.82rem',
                        marginBottom: '0.85rem',
                      }}
                    >
                      {g.tagline}
                    </p>
                    <ul
                      style={{ margin: 0, padding: 0, listStyle: 'none' }}
                    >
                      {g.points.map(([label, desc]) => (
                        <li
                          key={label}
                          style={{
                            paddingLeft: '0.95em',
                            position: 'relative',
                            color: CREAM_DIM,
                            fontFamily: 'var(--font-fraunces, serif)',
                            fontSize: '0.85rem',
                            lineHeight: 1.55,
                            marginBottom: '0.45rem',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              left: 0,
                              color: g.accent,
                            }}
                          >
                            ·
                          </span>
                          <strong style={{ color: CREAM }}>{label}.</strong>{' '}
                          {desc}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── Economics ─── */}
            <section id="economics" className="scroll-mt-28">
              <h2>§ 06 — Economics · fair by design</h2>
              <p>
                Traditional fundraising is unfair. Insiders get preferential
                terms, insider access, and early exits — while everyday
                believers get nothing.{' '}
                <strong>PNL flips this model entirely.</strong> Everyone plays
                by the same rules, and the supporters who backed the idea
                first get the biggest rewards.
              </p>

              <Callout
                eyebrow="No gatekeepers · no insiders · just believers"
                accent={FOREST}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    style={{
                      background: 'rgba(10,8,20,0.4)',
                      border: `1px solid ${EARTH}33`,
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <p
                      className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                      style={{ color: EARTH, marginBottom: '0.4rem' }}
                    >
                      Traditional projects
                    </p>
                    <ul style={{ margin: 0, listStyle: 'none', padding: 0 }}>
                      <li
                        style={{
                          color: CREAM_DIM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontSize: '0.8rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        Insiders · 50–70% at $0.001
                      </li>
                      <li
                        style={{
                          color: CREAM_DIM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontSize: '0.8rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        Team · 15–25% at $0.001
                      </li>
                      <li
                        style={{
                          color: CREAM_DIM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontSize: '0.8rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        Public · 5–10% at $0.10
                      </li>
                      <li
                        className="italic"
                        style={{
                          color: EARTH,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontStyle: 'italic',
                          fontSize: '0.78rem',
                        }}
                      >
                        → 100x price gap
                      </li>
                    </ul>
                  </div>
                  <div
                    style={{
                      background: 'rgba(10,8,20,0.4)',
                      border: `1px solid ${FOREST}33`,
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <p
                      className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                      style={{ color: FOREST, marginBottom: '0.4rem' }}
                    >
                      PNL distribution
                    </p>
                    <ul style={{ margin: 0, listStyle: 'none', padding: 0 }}>
                      <li
                        style={{
                          color: CREAM_DIM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontSize: '0.8rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        Early supporters · <strong style={{ color: CREAM }}>65%</strong>
                      </li>
                      <li
                        style={{
                          color: CREAM_DIM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontSize: '0.8rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        Founder · <strong style={{ color: CREAM }}>33%</strong> (vested)
                      </li>
                      <li
                        style={{
                          color: CREAM_DIM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontSize: '0.8rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        Platform · <strong style={{ color: CREAM }}>2%</strong>
                      </li>
                      <li
                        className="italic"
                        style={{
                          color: FOREST,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontStyle: 'italic',
                          fontSize: '0.78rem',
                        }}
                      >
                        → Same price for all
                      </li>
                    </ul>
                  </div>
                </div>
              </Callout>

              <p>
                Transparency is non-negotiable. Here's exactly where your SOL
                goes:
              </p>

              <div className="grid grid-cols-3 gap-2 my-4">
                <DistRow
                  label="To create"
                  pct="0.015"
                  accent={AMBER}
                  detail="Spam prevention"
                />
                <DistRow
                  label="Per vote"
                  pct="1.5%"
                  accent={PEACH}
                  detail="Platform revenue"
                />
                <DistRow
                  label="At resolution"
                  pct="5%"
                  accent={FOREST}
                  detail="Completion fee"
                />
              </div>

              <p>
                When YES wins, up to <strong>50 SOL</strong> goes to Pump.fun
                for token launch. Any excess above 50 SOL goes to the founder
                (<strong>8%</strong> immediate, <strong>92%</strong> vested
                over 12 months) — keeping founders committed long-term.
              </p>
            </section>

            {/* ─── Vision & roadmap ─── */}
            <section id="vision" className="scroll-mt-28">
              <h2>§ 07 — Vision · where we're going</h2>
              <p>
                For too long, tokens and equity have been treated as different
                things. But what if they're the same — just evolved for the
                internet age?{' '}
                <strong>PNL is pioneering idea tokenization</strong> — where
                your vision becomes an asset the world can believe in.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-6">
                <div
                  style={{
                    background: `${EARTH}0d`,
                    border: `1px solid ${EARTH}33`,
                    padding: '1.25rem',
                  }}
                >
                  <p
                    className="mono uppercase tracking-[0.26em] text-[0.55rem]"
                    style={{ color: EARTH, marginBottom: '0.5rem' }}
                  >
                    Traditional funding · broken
                  </p>
                  <p
                    style={{
                      color: CREAM_DIM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    Less than 1% of startups get funded. The other 99%? Rejected
                    — often not because of merit, but geography, network, or
                    pedigree. Brilliant builders in Lagos, Manila, São Paulo —
                    locked out of capital that flows freely in Silicon Valley.
                  </p>
                </div>
                <div
                  style={{
                    background: `${FOREST}0d`,
                    border: `1px solid ${FOREST}33`,
                    padding: '1.25rem',
                  }}
                >
                  <p
                    className="mono uppercase tracking-[0.26em] text-[0.55rem]"
                    style={{ color: FOREST, marginBottom: '0.5rem' }}
                  >
                    PNL · borderless
                  </p>
                  <p
                    style={{
                      color: CREAM_DIM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      marginBottom: '0.6rem',
                    }}
                  >
                    No rejection — every idea gets a fair shot. Build from
                    anywhere, raise from everywhere. The crowd decides, not
                    gatekeepers.
                  </p>
                  <p
                    className="italic"
                    style={{
                      color: FOREST,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontStyle: 'italic',
                      fontSize: '0.85rem',
                      margin: 0,
                    }}
                  >
                    The next unicorn might be building in a bedroom right now.
                    PNL will find them.
                  </p>
                </div>
              </div>

              <p>
                For early supporters, PNL is a{' '}
                <strong style={{ color: AMBER }}>treasure hunt</strong> —
                discover hidden gems before the world knows about them. Every
                market is a potential breakthrough waiting for believers to
                back it.
              </p>

              <h3>What's live now</h3>
              <p>Community features already shipped and ready to use:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 my-4">
                {[
                  { title: 'Community chat', body: 'Real-time discussions per market' },
                  { title: 'Voice rooms', body: 'Live audio spaces for each project' },
                  { title: 'AI analysis', body: 'Smart project scoring' },
                ].map((f) => (
                  <div
                    key={f.title}
                    style={{
                      background: `${FOREST}0d`,
                      border: `1px solid ${FOREST}33`,
                      padding: '0.85rem',
                    }}
                  >
                    <p
                      className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                      style={{ color: FOREST, marginBottom: '0.3rem' }}
                    >
                      {f.title}
                    </p>
                    <p
                      style={{
                        color: CREAM_FAINT,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontSize: '0.75rem',
                        margin: 0,
                      }}
                    >
                      {f.body}
                    </p>
                  </div>
                ))}
              </div>

              <h3>What's coming next</h3>
              <p>More features on the roadmap:</p>
              <div className="grid grid-cols-2 gap-2 my-4">
                {[
                  { title: 'Reputation system', body: 'Track record & credibility scores' },
                  { title: 'Teams & talent', body: 'Find collaborators for your project' },
                ].map((f) => (
                  <div
                    key={f.title}
                    style={{
                      background: `${PEACH}0d`,
                      border: `1px solid ${PEACH}33`,
                      padding: '0.85rem',
                    }}
                  >
                    <p
                      className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                      style={{ color: PEACH, marginBottom: '0.3rem' }}
                    >
                      {f.title}
                    </p>
                    <p
                      style={{
                        color: CREAM_FAINT,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontSize: '0.75rem',
                        margin: 0,
                      }}
                    >
                      {f.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── Technical ─── */}
            <section id="technical" className="scroll-mt-28">
              <h2>§ 08 — Technical architecture</h2>

              <div
                style={{
                  background: 'rgba(244,238,228,0.025)',
                  border: `1px solid ${HAIR_STRONG}`,
                  padding: '1.25rem 1.5rem',
                  margin: '1.5rem 0',
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  {[
                    ['Blockchain', 'Solana mainnet · Anchor framework'],
                    ['Token launch', 'Pump.fun (vault-locked)'],
                    ['Storage', 'IPFS via Pinata'],
                    ['Authentication', 'Privy'],
                    ['Indexing', 'Helius RPC + websocket'],
                    ['Front end', 'Next.js 14 · TypeScript · Tailwind'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-3">
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                        style={{
                          color: CREAM_FAINT,
                          minWidth: '5.5rem',
                        }}
                      >
                        {k}
                      </span>
                      <span
                        style={{
                          color: CREAM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontSize: '0.88rem',
                        }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <h3>The AMM at the heart of PNL</h3>
              <p>
                PNL uses a{' '}
                <strong style={{ color: AMBER }}>constant product AMM</strong>{' '}
                — the same mechanism that powers Uniswap. Two pools (YES and
                NO) start with equal liquidity. Every vote rebalances them.
              </p>
              <p>
                When you vote YES, your SOL goes into the NO pool. The YES
                pool decreases proportionally, raising the price of YES shares.
                The constant{' '}
                <code style={{ fontSize: '0.95em' }}>k = yesPool × noPool</code>{' '}
                is preserved — that's why it's called "constant product."
              </p>
              <p>
                Price = probability. If YES is 70% probable, you pay 0.70 per
                share. The market reveals what the crowd believes.
              </p>

              {/* Embedded simulator */}
              <AMMSimulator />

              <h3>Atomic resolution</h3>
              <p>
                When a market resolves, three things happen in a single Solana
                transaction:
              </p>
              <ol>
                <li>
                  <strong>Vault unlocks.</strong> The pool SOL becomes
                  available for distribution.
                </li>
                <li>
                  <strong>Outcome distribution.</strong> If YES wins, up to 50
                  SOL goes to Pump.fun for token launch; tokens are minted and
                  the airdrop allocation is calculated. If NO wins, 95% of
                  pool is split among NO voters proportionally.
                </li>
                <li>
                  <strong>Vesting schedules deploy.</strong> Founder tokens
                  (33% of supply) and any excess SOL (above 50) lock into a
                  12-month linear vesting contract.
                </li>
              </ol>
              <p
                className="italic"
                style={{
                  color: CREAM_DIM,
                  fontStyle: 'italic',
                }}
              >
                Atomic — meaning it all succeeds or all fails. No half-states.
                No race conditions.
              </p>
            </section>

            {/* ─── Community CTA ─── */}
            <section id="community" className="scroll-mt-28">
              <h2>§ 09 — Join the grove</h2>
              <p>
                PNL is community-owned. We don't have a marketing team. We
                have <em>you</em> — believers who want to fund what matters.
              </p>

              <Callout accent={AMBER}>
                <p
                  className="text-center italic"
                  style={{
                    color: CREAM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontStyle: 'italic',
                    fontSize: '1.05rem',
                    margin: '0 0 0.6rem 0',
                  }}
                >
                  "Fueling the world's brilliant ideas — from anywhere, for
                  everyone."
                </p>
                <p
                  className="text-center mono uppercase tracking-[0.32em] text-[0.55rem]"
                  style={{ color: AMBER, margin: 0 }}
                >
                  Yours could be next.
                </p>
              </Callout>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
                <a
                  href="https://x.com/pnldotmarket"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wp-community-card"
                >
                  <p
                    className="mono uppercase tracking-[0.26em] text-[0.55rem]"
                    style={{ color: AMBER, marginBottom: '0.4rem' }}
                  >
                    Follow on X
                  </p>
                  <p
                    style={{
                      color: CREAM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontSize: '1rem',
                      margin: 0,
                    }}
                  >
                    @pnldotmarket
                  </p>
                </a>
                <a
                  href="https://discord.gg/38pkg4vm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wp-community-card"
                >
                  <p
                    className="mono uppercase tracking-[0.26em] text-[0.55rem]"
                    style={{ color: AMBER, marginBottom: '0.4rem' }}
                  >
                    Talk in the grove
                  </p>
                  <p
                    style={{
                      color: CREAM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontSize: '1rem',
                      margin: 0,
                    }}
                  >
                    Discord community
                  </p>
                </a>
              </div>
            </section>

            {/* ─── Disclaimer ─── */}
            <section id="disclaimer" className="scroll-mt-28">
              <h2>§ 10 — Disclaimer</h2>
              <p
                style={{
                  color: CREAM_FAINT,
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                }}
              >
                This whitepaper is provided for informational purposes only.
                Nothing herein constitutes financial, legal, or investment
                advice. Cryptocurrency and prediction markets are speculative
                and inherently risky. Token values are volatile and you may
                lose your entire investment. Past performance does not
                guarantee future results. PNL (a service of WOLP LLC) does not
                guarantee any specific outcome from participation in markets.
                By using the platform you accept the risks described in our
                Terms of Service. Always do your own research and only stake
                what you can afford to lose.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
