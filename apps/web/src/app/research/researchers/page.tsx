/**
 * /research/researchers
 *
 * Index of every author who has published at least one paper, ranked by
 * paper count and recent activity. The closest thing to a "research
 * community" surface — builds itself from existing data, no new model
 * required.
 */

import Link from 'next/link';
import { connectToDatabase, ResearchPaper, PaperCitation } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

export const metadata = {
  title: 'Researchers · PNL',
  description: 'Every author who has published research on PNL.',
};

interface AuthorAgg {
  wallet: string;
  displayName: string;
  xHandle: string | null;
  paperCount: number;
  totalLikes: number;
  totalDislikes: number;
  lastActive: Date;
  citedInCount: number;
}

export default async function ResearchersPage() {
  await connectToDatabase();

  // Aggregate: one row per author, with paper count + sentiment + most
  // recent activity. Identity is taken from the most recent paper so the
  // byline matches what's shown elsewhere in the app.
  const aggregation = await ResearchPaper.aggregate([
    { $match: { status: 'active' } },
    { $sort: { updatedAt: -1, createdAt: -1 } },
    {
      $group: {
        _id: '$authorWallet',
        latestName: { $first: '$authorName' },
        latestHandle: { $first: '$authorXHandle' },
        paperCount: { $sum: 1 },
        totalLikes: { $sum: { $ifNull: ['$likeCount', 0] } },
        totalDislikes: { $sum: { $ifNull: ['$dislikeCount', 0] } },
        lastActive: { $max: { $ifNull: ['$updatedAt', '$createdAt'] } },
      },
    },
    { $sort: { paperCount: -1, lastActive: -1 } },
  ]);

  // For each author, count visible citations (auto + accepted) on their
  // papers — this is the "cited in" count shown on the card.
  const wallets = aggregation.map((a: any) => a._id);
  const citedInRaw = wallets.length
    ? await PaperCitation.aggregate([
        {
          $match: {
            paperAuthorWallet: { $in: wallets },
            status: { $in: ['auto', 'accepted'] },
          },
        },
        { $group: { _id: '$paperAuthorWallet', count: { $sum: 1 } } },
      ])
    : [];
  const citedInByWallet = new Map<string, number>(
    citedInRaw.map((r: any) => [r._id, r.count]),
  );

  const authors: AuthorAgg[] = aggregation.map((a: any) => ({
    wallet: a._id,
    displayName: a.latestName,
    xHandle: a.latestHandle || null,
    paperCount: a.paperCount,
    totalLikes: a.totalLikes,
    totalDislikes: a.totalDislikes,
    lastActive: a.lastActive,
    citedInCount: citedInByWallet.get(a._id) || 0,
  }));

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto pt-8 sm:pt-12">
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-8 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            ← back to the catalog
          </Link>

          <header className="mb-12">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
              style={{ color: AMBER }}
            >
              Researchers
            </p>
            <h1
              className="leading-[1.05] mb-3"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
                fontFeatureSettings: '"ss01"',
                letterSpacing: '-0.01em',
              }}
            >
              {authors.length === 0
                ? 'Nobody’s published yet.'
                : `${authors.length} ${authors.length === 1 ? 'voice' : 'voices'} on the shelf.`}
            </h1>
            <p
              className="max-w-prose"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.05rem',
                lineHeight: 1.5,
              }}
            >
              Every author who has planted a paper, ranked by output and
              recency. Click any name to read their work and see who’s building
              on it.
            </p>
          </header>

          {authors.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {authors.map((author) => (
                <li key={author.wallet}>
                  <ResearcherCard author={author} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ResearcherCard({ author }: { author: AuthorAgg }) {
  return (
    <Link
      href={`/research/author/${author.wallet}`}
      prefetch
      className="block px-4 py-4 transition-colors"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
      }}
    >
      <p
        className="line-clamp-1 mb-1"
        style={{
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.2rem',
          fontWeight: 400,
        }}
      >
        {author.displayName}
      </p>
      <p
        className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-3"
        style={{ color: CREAM_FAINT }}
      >
        {author.xHandle ? (
          <span style={{ color: AMBER }}>@{author.xHandle}</span>
        ) : (
          <span>—</span>
        )}
        <span className="mx-1.5" style={{ color: HAIR_STRONG }}>·</span>
        wallet {author.wallet.slice(0, 4)}…{author.wallet.slice(-4)}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="papers" value={String(author.paperCount)} accent={AMBER} />
        <Stat
          label="ticks"
          value={String(author.totalLikes)}
          accent={FOREST}
        />
        <Stat
          label="cited in"
          value={String(author.citedInCount)}
          accent={author.citedInCount > 0 ? FOREST : CREAM_FAINT}
        />
      </div>

      <p
        className="mt-3 mono uppercase tracking-[0.2em] text-[0.5rem]"
        style={{ color: CREAM_FAINT }}
      >
        last active{' '}
        {new Date(author.lastActive).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>
    </Link>
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
      className="px-2 py-2"
      style={{ background: 'rgba(244,238,228,0.025)' }}
    >
      <p
        className="mono uppercase tracking-[0.18em] text-[0.5rem] mb-0.5"
        style={{ color: CREAM_FAINT }}
      >
        {label}
      </p>
      <p
        style={{
          color: accent,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.1rem',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="text-center py-16 px-6"
      style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
    >
      <h3
        className="mb-2"
        style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.4rem' }}
      >
        The shelf is empty.
      </h3>
      <p
        className="mx-auto max-w-md italic mb-6"
        style={{
          color: CREAM_DIM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1rem',
        }}
      >
        Be the first to plant a paper.
      </p>
      <Link
        href="/create"
        prefetch
        className="mono uppercase tracking-[0.24em] text-[0.6rem] inline-block px-5 py-2.5 transition-colors"
        style={{ background: AMBER, color: '#0a0814' }}
      >
        Publish a paper
      </Link>
    </div>
  );
}
