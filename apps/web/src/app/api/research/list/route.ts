/**
 * GET /api/research/list
 *
 * Paginated list of active research papers, newest first.
 * Public; no auth required to browse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
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

    return NextResponse.json({
      success: true,
      data: {
        papers: papers.map((p: any) => ({
          id: String(p._id),
          title: p.title,
          authorName: p.authorName,
          authorXHandle: p.authorXHandle || null,
          paperUrl: convertToGatewayUrl(p.paperUrl) || p.paperUrl,
          summary: p.summary || null,
          githubUrl: p.githubUrl || null,
          likeCount: p.likeCount || 0,
          dislikeCount: p.dislikeCount || 0,
          createdAt: p.createdAt,
        })),
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
