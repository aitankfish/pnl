/**
 * GET /api/research/[id]
 *
 * Fetch a single research paper. Public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const paper = await ResearchPaper.findById(id).lean<any>();

    if (!paper || paper.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Paper not found' },
        { status: 404 },
      );
    }

    // Synthesize v1 on the fly for legacy papers that predate the versions
    // array. Read-only — if/when an author publishes a revision, the
    // version POST endpoint persists this v1 entry for real.
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
              changelog: 'First published',
              createdAt: paper.createdAt,
            },
          ];

    return NextResponse.json({
      success: true,
      data: {
        id: String(paper._id),
        title: paper.title,
        authorName: paper.authorName,
        authorXHandle: paper.authorXHandle || null,
        authorWallet: paper.authorWallet,
        paperUrl: convertToGatewayUrl(paper.paperUrl) || paper.paperUrl,
        summary: paper.summary || null,
        githubUrl: paper.githubUrl || null,
        currentVersion: paper.currentVersion || 1,
        versions: versions.map((v: any) => ({
          version: v.version,
          paperUrl: convertToGatewayUrl(v.paperUrl) || v.paperUrl,
          title: v.title,
          summary: v.summary || null,
          githubUrl: v.githubUrl || null,
          changelog: v.changelog || null,
          createdAt: v.createdAt,
        })),
        likeCount: paper.likeCount || 0,
        dislikeCount: paper.dislikeCount || 0,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt || paper.createdAt,
      },
    });
  } catch (error) {
    logger.error('[research/[id]] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load paper' },
      { status: 500 },
    );
  }
}
