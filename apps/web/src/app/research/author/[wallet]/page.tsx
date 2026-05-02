/**
 * Author profile page.
 *
 * Cosmic-plant editorial header (display name, X handle, aggregate
 * stats) plus a grid of every paper that wallet has published. All
 * server-rendered — no interactive state needed at this layer.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  connectToDatabase,
  PaperCitation,
  PredictionMarket,
  Project,
  ResearchPaper,
} from '@/lib/mongodb';
import { convertToGatewayUrl } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Cosmic-plant palette (kept in sync with the rest of the app).
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

// Paper-card palette (used inside each card).
const PAPER_BG = '#fbfaf6';
const INK = '#0d0d0d';
const INK_DIM = 'rgba(13,13,13,0.62)';
const INK_FAINT = 'rgba(13,13,13,0.35)';

interface PageProps {
  params: Promise<{ wallet: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { wallet } = await params;
  if (!WALLET_RE.test(wallet)) return { title: 'Author not found · PNL' };
  try {
    await connectToDatabase();
    const latest = await ResearchPaper.findOne({
      authorWallet: wallet,
      status: 'active',
    })
      .sort({ createdAt: -1 })
      .lean<any>();
    if (!latest) return { title: 'Author not found · PNL' };
    return {
      title: `${latest.authorName} — research on PNL`,
      description: `Papers and signal from ${latest.authorName}.`,
    };
  } catch {
    return { title: 'Author · PNL' };
  }
}

export default async function AuthorPage({ params }: PageProps) {
  const { wallet } = await params;
  if (!WALLET_RE.test(wallet)) notFound();

  await connectToDatabase();
  const papers = await ResearchPaper.find({
    authorWallet: wallet,
    status: 'active',
  })
    .sort({ createdAt: -1 })
    .lean<any[]>();

  if (!papers || papers.length === 0) notFound();

  const latest = papers[0];
  const totalLikes = papers.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const totalDislikes = papers.reduce(
    (sum, p) => sum + (p.dislikeCount || 0),
    0,
  );
  const firstPublished = papers[papers.length - 1].createdAt;

  // "Cited in" — projects that visibly cite any of this author's papers.
  // We only show auto + accepted so the surface only fills out once a
  // citation has been deliberately approved (or auto-accepted as own).
  const visibleCitations = await PaperCitation.find({
    paperAuthorWallet: wallet,
    status: { $in: ['auto', 'accepted'] },
  })
    .sort({ createdAt: -1 })
    .lean<any[]>();
  const citationProjectIds = visibleCitations.map((c) => c.projectId);
  const [citingProjects, citingMarkets] = citationProjectIds.length
    ? await Promise.all([
        Project.find({ _id: { $in: citationProjectIds } }).lean<any[]>(),
        PredictionMarket.find({ projectId: { $in: citationProjectIds } }).lean<any[]>(),
      ])
    : [[] as any[], [] as any[]];
  const projectById = new Map(citingProjects.map((p: any) => [String(p._id), p]));
  const marketByProject = new Map(
    citingMarkets.map((m: any) => [String(m.projectId), m]),
  );
  const citedInRows = visibleCitations
    .map((c) => {
      const project = projectById.get(String(c.projectId));
      if (!project) return null;
      const market = marketByProject.get(String(c.projectId));
      return {
        id: String(c._id),
        role: c.role,
        sameWallet: c.paperAuthorWallet === c.addedBy,
        project: {
          id: String(project._id),
          name: project.name,
          tokenSymbol: project.tokenSymbol,
        },
        marketAddress: market?.marketAddress || null,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      role: 'thesis' | 'foundation' | 'reference';
      sameWallet: boolean;
      project: { id: string; name: string; tokenSymbol: string };
      marketAddress: string | null;
    }>;

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto pt-8 sm:pt-12">
          {/* ─── Back link ─── */}
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-8 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            ← back to the catalog
          </Link>

          {/* ─── Editorial header ─── */}
          <header className="mb-12 sm:mb-16">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
              style={{ color: AMBER }}
            >
              Researcher
            </p>
            <h1
              className="leading-[1.05] mb-3"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(2.4rem, 6vw, 4rem)',
                fontFeatureSettings: '"ss01"',
                letterSpacing: '-0.01em',
              }}
            >
              {latest.authorName}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
              {latest.authorXHandle && (
                <a
                  href={`https://x.com/${latest.authorXHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono uppercase tracking-[0.22em] text-[0.62rem] transition-colors"
                  style={{ color: AMBER }}
                >
                  @{latest.authorXHandle}
                </a>
              )}
              <span
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: CREAM_FAINT }}
                title={wallet}
              >
                wallet · {wallet.slice(0, 4)}…{wallet.slice(-4)}
              </span>
            </div>

            {/* Aggregate stats */}
            <div
              className="grid grid-cols-3 gap-px max-w-md"
              style={{ background: HAIR_STRONG }}
            >
              <Stat
                label="papers"
                value={String(papers.length)}
                accent={AMBER}
              />
              <Stat
                label="ticks"
                value={String(totalLikes)}
                accent={FOREST}
              />
              <Stat
                label="crosses"
                value={String(totalDislikes)}
                accent={EARTH}
              />
            </div>

            {firstPublished && (
              <p
                className="mt-6 mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: CREAM_FAINT }}
              >
                Publishing on PNL since{' '}
                {new Date(firstPublished).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                })}
              </p>
            )}
          </header>

          {/* ─── Paper grid ─── */}
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4"
            style={{ color: AMBER }}
          >
            The shelf
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {papers.map((p) => (
              <PaperCard key={String(p._id)} paper={p} />
            ))}
          </div>

          {/* ─── Cited in (projects building on this researcher's papers) ─── */}
          {citedInRows.length > 0 && (
            <div className="mt-12">
              <p
                className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4"
                style={{ color: AMBER }}
              >
                Cited in {citedInRows.length} project{citedInRows.length === 1 ? '' : 's'}
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {citedInRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/market/${row.marketAddress || row.project.id}`}
                      prefetch
                      className="block px-4 py-3 transition-colors"
                      style={{
                        background: 'rgba(244,238,228,0.025)',
                        border: `1px solid ${HAIR_STRONG}`,
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <p
                          className="line-clamp-1"
                          style={{
                            color: CREAM,
                            fontFamily: 'var(--font-fraunces, serif)',
                            fontSize: '1rem',
                          }}
                        >
                          {row.project.name}
                        </p>
                        <span
                          className="mono uppercase tracking-[0.18em] text-[0.55rem] flex-shrink-0"
                          style={{ color: AMBER }}
                        >
                          ${row.project.tokenSymbol}
                        </span>
                      </div>
                      <p
                        className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                        style={{ color: CREAM_FAINT }}
                      >
                        {row.role}
                        {!row.sameWallet && (
                          <>
                            {' · '}
                            <span style={{ color: FOREST }}>✓ accepted</span>
                          </>
                        )}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="px-4 py-3"
      style={{ background: 'rgba(244,238,228,0.025)' }}
    >
      <p
        className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-1"
        style={{ color: CREAM_FAINT }}
      >
        {label}
      </p>
      <p
        style={{
          color: accent,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.6rem',
          fontWeight: 350,
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function PaperCard({ paper }: { paper: any }) {
  const dateLabel = new Date(paper.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <Link
      href={`/research/${String(paper._id)}`}
      prefetch
      className="block transition-transform"
      style={{
        background: PAPER_BG,
        color: INK,
        borderLeft: `2px solid ${INK}`,
        padding: '1.25rem 1.25rem 1rem',
        minHeight: 200,
      }}
    >
      <p
        className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-3"
        style={{ color: INK_FAINT }}
      >
        Research · {dateLabel}
      </p>
      <h3
        className="line-clamp-3 mb-2"
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.2rem',
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: '-0.005em',
        }}
      >
        {paper.title}
      </h3>
      {paper.summary && (
        <p
          className="text-sm line-clamp-2 mb-4"
          style={{
            fontFamily: 'var(--font-fraunces, serif)',
            color: INK_DIM,
            lineHeight: 1.4,
          }}
        >
          {paper.summary}
        </p>
      )}
      <div
        className="flex items-center gap-4 mt-auto pt-3"
        style={{ borderTop: `1px solid rgba(13,13,13,0.08)` }}
      >
        <span className="inline-flex items-center gap-1.5" style={{ color: FOREST }}>
          ✓
          <span className="mono text-[0.7rem]" style={{ fontFeatureSettings: '"tnum"' }}>
            {paper.likeCount || 0}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: EARTH }}>
          ✗
          <span className="mono text-[0.7rem]" style={{ fontFeatureSettings: '"tnum"' }}>
            {paper.dislikeCount || 0}
          </span>
        </span>
      </div>
    </Link>
  );
}
