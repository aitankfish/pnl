/**
 * GET /api/research/list
 *
 * Paginated list of active research papers, newest first.
 * Public; no auth required to browse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ResearchPaper, ResearchProgram } from '@/lib/mongodb';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 100);
    const skip = Math.max(parseInt(searchParams.get('skip') || '0', 10), 0);

    await connectToDatabase();

    const [papers, total] = await Promise.all([
      ResearchPaper.find({ status: 'active' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ResearchPaper.countDocuments({ status: 'active' }),
    ]);

    // Resolve program membership + lineage parent titles in two batch queries so
    // the shelf can show "part of <program>" and "builds on <paper>".
    const programIds = [...new Set(papers.map((p: any) => p.programId).filter(Boolean).map(String))];
    const parentIds = [...new Set(papers.map((p: any) => p.parentPaperId).filter(Boolean).map(String))];

    const [programs, parents] = await Promise.all([
      programIds.length
        ? ResearchProgram.find({ _id: { $in: programIds }, status: 'active' })
            .select('slug title')
            .lean<any[]>()
        : Promise.resolve([]),
      parentIds.length
        ? ResearchPaper.find({ _id: { $in: parentIds }, status: 'active' })
            .select('title')
            .lean<any[]>()
        : Promise.resolve([]),
    ]);
    const programById = new Map(programs.map((g) => [String(g._id), { slug: g.slug, title: g.title }]));
    const parentTitleById = new Map(parents.map((p) => [String(p._id), p.title]));

    return NextResponse.json({
      success: true,
      data: {
        papers: papers.map((p: any) => {
          const program = p.programId ? programById.get(String(p.programId)) || null : null;
          const parentTitle = p.parentPaperId ? parentTitleById.get(String(p.parentPaperId)) || null : null;
          return {
            id: String(p._id),
            title: p.title,
            authorName: p.authorName,
            authorXHandle: p.authorXHandle || null,
            paperUrl: convertToGatewayUrl(p.paperUrl) || p.paperUrl,
            summary: p.summary || null,
            githubUrl: p.githubUrl || null,
            program, // { slug, title } | null
            parentTitle, // title of the paper this builds on | null
            likeCount: p.likeCount || 0,
            dislikeCount: p.dislikeCount || 0,
            createdAt: p.createdAt,
          };
        }),
        total,
        limit,
        skip,
      },
    });
  } catch (error) {
    logger.error('[research/list] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load papers' },
      { status: 500 },
    );
  }
}
