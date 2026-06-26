/**
 * Research program page — a body of work that accumulates papers over time.
 *
 * The credibility surface for onboarding researchers: an outsider lands here and
 * sees multiple papers with lineage, DOIs, and the staked conviction behind the
 * program, instead of scattered one-off posts.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, GitBranch } from 'lucide-react';
import { getProgramDetail, type ProgramPaper } from '@/lib/research-programs';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Cosmic-plant palette (kept in sync with the research/create surfaces).
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const program = await getProgramDetail(slug);
  if (!program) return { title: 'Program not found · PNL' };
  return {
    title: `${program.title} — research program · PNL`,
    description: program.summary || `A research program with ${program.papers.length} papers.`,
  };
}

export default async function ResearchProgramPage({ params }: PageProps) {
  const { slug } = await params;
  const program = await getProgramDetail(slug);
  if (!program) notFound();

  const { conviction, papers } = program;
  const titleById = new Map(papers.map((p) => [p.id, p.title]));
  const sol = conviction.totalSol;
  const solLabel = sol >= 0.001 ? sol.toFixed(3) : sol > 0 ? '<0.001' : '0';

  return (
    <div style={{ background: BG, minHeight: '100vh', color: CREAM }}>
      <div className="max-w-[920px] mx-auto px-6 sm:px-10 py-10 sm:py-16">
        <Link
          href="/research"
          className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-10"
          style={{ color: CREAM_DIM }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          research
        </Link>

        {/* Program header */}
        <header className="mb-10">
          <p className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3" style={{ color: AMBER }}>
            Research program
          </p>
          <h1
            className="leading-[1.05] mb-4"
            style={{
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 350,
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            }}
          >
            {program.title}
          </h1>
          {program.summary && (
            <p
              className="max-w-2xl mb-6"
              style={{
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.15rem',
                lineHeight: 1.5,
                color: CREAM_DIM,
              }}
            >
              {program.summary}
            </p>
          )}

          {/* Stat strip — papers + staked conviction */}
          <div className="flex flex-wrap items-stretch gap-3">
            <Stat label="Papers" value={String(papers.length)} />
            <Stat label="SOL staked" value={solLabel} accent />
            <Stat label="Backing markets" value={String(conviction.backingMarkets)} />
            <Link
              href={`/research/author/${program.ownerWallet}`}
              className="flex flex-col justify-center px-4 py-2.5 transition-colors"
              style={{ border: `1px solid ${HAIR}` }}
            >
              <span className="mono uppercase tracking-[0.2em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>
                Led by
              </span>
              <span className="mono text-[0.7rem]" style={{ color: CREAM }}>
                {program.ownerWallet.slice(0, 4)}…{program.ownerWallet.slice(-4)}
              </span>
            </Link>
          </div>
          {conviction.backingMarkets > 0 && (
            <p className="mono uppercase tracking-[0.2em] text-[0.5rem] mt-3" style={{ color: CREAM_FAINT }}>
              Staked across this program’s conviction markets · live from on-chain pools
            </p>
          )}
        </header>

        {/* Papers in lineage order */}
        {papers.length === 0 ? (
          <p
            className="py-10 text-center"
            style={{ fontFamily: 'var(--font-fraunces, serif)', color: CREAM_FAINT }}
          >
            No papers in this program yet.
          </p>
        ) : (
          <div className="space-y-4">
            {papers.map((paper, i) => (
              <ProgramPaperCard
                key={paper.id}
                paper={paper}
                index={i}
                parentTitle={paper.parentPaperId ? titleById.get(paper.parentPaperId) || null : null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col justify-center px-4 py-2.5" style={{ border: `1px solid ${HAIR}` }}>
      <span className="mono uppercase tracking-[0.2em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.3rem',
          color: accent ? AMBER : CREAM,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ProgramPaperCard({
  paper,
  index,
  parentTitle,
}: {
  paper: ProgramPaper;
  index: number;
  parentTitle: string | null;
}) {
  return (
    <div
      className="relative px-5 sm:px-6 py-5"
      style={{ border: `1px solid ${HAIR}`, background: 'rgba(244,238,228,0.025)' }}
    >
      <div className="flex items-baseline gap-3 mb-1.5">
        <span className="mono text-[0.7rem]" style={{ color: CREAM_FAINT }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <Link
          href={`/research/${paper.id}`}
          className="hover:underline underline-offset-4"
          style={{
            fontFamily: 'var(--font-fraunces, serif)',
            fontSize: '1.3rem',
            fontWeight: 400,
            lineHeight: 1.2,
            color: CREAM,
          }}
        >
          {paper.title}
        </Link>
      </div>

      {parentTitle && (
        <p
          className="inline-flex items-center gap-1.5 mono uppercase tracking-[0.18em] text-[0.5rem] mb-2"
          style={{ color: FOREST }}
        >
          <GitBranch className="w-3 h-3" />
          builds on {parentTitle}
        </p>
      )}

      <p className="text-sm mb-2" style={{ fontFamily: 'var(--font-fraunces, serif)', color: CREAM_DIM }}>
        by {paper.authorName}
      </p>

      {paper.summary && (
        <p
          className="text-sm line-clamp-2 mb-3"
          style={{ fontFamily: 'var(--font-fraunces, serif)', color: CREAM_DIM, lineHeight: 1.5 }}
        >
          {paper.summary}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mono uppercase tracking-[0.18em] text-[0.55rem] hover:underline underline-offset-2"
            style={{ color: FOREST }}
            title={`Published · DOI ${paper.doi}`}
          >
            DOI {paper.doi}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <Link
          href={`/research/${paper.id}`}
          className="mono uppercase tracking-[0.2em] text-[0.55rem] hover:underline underline-offset-2"
          style={{ color: CREAM_DIM }}
        >
          read →
        </Link>
      </div>
    </div>
  );
}
