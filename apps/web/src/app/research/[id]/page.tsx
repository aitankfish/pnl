/**
 * Research paper detail page.
 *
 * White-paper aesthetic: cream background, black ink, vertical rule on the
 * left edge, sentiment tick/X anchored to the right of the paper. Deliberately
 * breaks from the cosmic-plant theme to feel like an actual paper.
 */

import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import Link from 'next/link';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { ResearchPaperClient } from './ResearchPaperClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return { title: 'Paper not found · PNL' };
  try {
    await connectToDatabase();
    const paper = await ResearchPaper.findById(id).lean<any>();
    if (!paper || paper.status !== 'active') return { title: 'Paper not found · PNL' };
    return {
      title: `${paper.title} — by ${paper.authorName} · PNL`,
      description: paper.summary || `A research paper by ${paper.authorName}.`,
    };
  } catch {
    return { title: 'Research paper · PNL' };
  }
}

export default async function ResearchPaperPage({ params }: PageProps) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const paper = await ResearchPaper.findById(id).lean<any>();
  if (!paper || paper.status !== 'active') notFound();

  const paperUrl = convertToGatewayUrl(paper.paperUrl) || paper.paperUrl;

  // Same lazy v1 synthesis as in /api/research/[id]/route.ts so the UI
  // always has at least one entry to render in the version panel.
  const rawVersions = Array.isArray(paper.versions) ? paper.versions : [];
  const versions =
    rawVersions.length > 0
      ? rawVersions
      : [
          {
            version: 1,
            paperUrl: paper.paperUrl,
            title: paper.title,
            summary: paper.summary,
            githubUrl: paper.githubUrl,
            doi: paper.doi,
            externalUrl: paper.externalUrl,
            changelog: 'First published',
            createdAt: paper.createdAt,
          },
        ];
  return (
    <ResearchPaperClient
      paper={{
        id: String(paper._id),
        title: paper.title,
        authorName: paper.authorName,
        authorXHandle: paper.authorXHandle || null,
        authorWallet: paper.authorWallet,
        paperUrl: paper.paperUrl ? paperUrl : null,
        summary: paper.summary || null,
        githubUrl: paper.githubUrl || null,
        doi: paper.doi || null,
        externalUrl: paper.externalUrl || null,
        likeCount: paper.likeCount || 0,
        dislikeCount: paper.dislikeCount || 0,
        createdAt:
          paper.createdAt instanceof Date
            ? paper.createdAt.toISOString()
            : String(paper.createdAt),
        currentVersion: paper.currentVersion || 1,
        versions: versions.map((v: any) => ({
          version: v.version,
          paperUrl: v.paperUrl ? convertToGatewayUrl(v.paperUrl) || v.paperUrl : null,
          title: v.title,
          summary: v.summary || null,
          githubUrl: v.githubUrl || null,
          doi: v.doi || null,
          externalUrl: v.externalUrl || null,
          changelog: v.changelog || null,
          createdAt:
            v.createdAt instanceof Date
              ? v.createdAt.toISOString()
              : String(v.createdAt),
        })),
      }}
    />
  );
}
