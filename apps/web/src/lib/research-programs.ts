/**
 * Research-program read model — shared by the API route and the SSR page so the
 * conviction aggregation lives in exactly one place.
 *
 * A program's aggregate conviction is READ from the synced pool balances of the
 * markets that cite the program's papers (role-agnostic, visible citations
 * only). Never written on-chain; pure read over Mongo-synced data.
 */

import {
  connectToDatabase,
  ResearchProgram,
  ResearchPaper,
  PaperCitation,
  Project,
} from '@/lib/mongodb';
import { convertToGatewayUrl } from '@/lib/api-utils';

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface ProgramPaper {
  id: string;
  title: string;
  authorName: string;
  authorWallet: string;
  summary: string | null;
  paperUrl: string | null;
  doi: string | null;
  externalUrl: string | null;
  parentPaperId: string | null;
  likeCount: number;
  createdAt: string;
}

export interface ProgramDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  ownerWallet: string;
  createdAt: string;
  conviction: {
    totalLamports: string;
    totalSol: number;
    backingMarkets: number;
  };
  papers: ProgramPaper[];
}

export async function getProgramDetail(slug: string): Promise<ProgramDetail | null> {
  await connectToDatabase();

  const program = await ResearchProgram.findOne({ slug, status: 'active' }).lean<any>();
  if (!program) return null;

  const programId = String(program._id);
  const papers = await ResearchPaper.find({ programId, status: 'active' })
    .sort({ createdAt: 1 })
    .lean<any[]>();

  const ordered = orderByLineage(papers);
  const paperIds = ordered.map((p) => String(p._id));

  let backingProjectIds: string[] = [];
  if (paperIds.length) {
    const citations = await PaperCitation.find({
      paperId: { $in: paperIds },
      status: { $in: ['auto', 'accepted'] },
    })
      .select('projectId')
      .lean<any[]>();
    backingProjectIds = [...new Set(citations.map((c) => String(c.projectId)))];
  }

  let totalLamports = 0n;
  if (backingProjectIds.length) {
    const projects = await Project.find({ _id: { $in: backingProjectIds } })
      .select('poolBalance')
      .lean<any[]>();
    for (const proj of projects) totalLamports += safeBigInt(proj.poolBalance);
  }

  return {
    id: programId,
    slug: program.slug,
    title: program.title,
    summary: program.summary || null,
    ownerWallet: program.ownerWallet,
    createdAt: toIso(program.createdAt),
    conviction: {
      totalLamports: totalLamports.toString(),
      totalSol: Number(totalLamports) / LAMPORTS_PER_SOL,
      backingMarkets: backingProjectIds.length,
    },
    papers: ordered.map((p) => ({
      id: String(p._id),
      title: p.title,
      authorName: p.authorName,
      authorWallet: p.authorWallet,
      summary: p.summary || null,
      paperUrl: p.paperUrl ? convertToGatewayUrl(p.paperUrl) || p.paperUrl : null,
      doi: p.doi || null,
      externalUrl: p.externalUrl || null,
      parentPaperId: p.parentPaperId || null,
      likeCount: p.likeCount || 0,
      createdAt: toIso(p.createdAt),
    })),
  };
}

// Order papers so each follows the paper it builds on. Roots (no in-program
// parent) first by date; children appended once their parent is placed. Falls
// back to chronological so nothing is dropped on an orphan or a cycle.
function orderByLineage(papers: any[]): any[] {
  const byId = new Map(papers.map((p) => [String(p._id), p]));
  const placed = new Set<string>();
  const out: any[] = [];

  const place = (p: any) => {
    const id = String(p._id);
    if (placed.has(id)) return;
    placed.add(id);
    out.push(p);
    papers
      .filter((c) => String(c.parentPaperId) === id)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .forEach(place);
  };

  papers
    .filter((p) => !p.parentPaperId || !byId.has(String(p.parentPaperId)))
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .forEach(place);
  papers.forEach((p) => place(p));

  return out;
}

function safeBigInt(v: unknown): bigint {
  try {
    if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v));
  } catch {
    /* fall through */
  }
  return 0n;
}

function toIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d);
}
