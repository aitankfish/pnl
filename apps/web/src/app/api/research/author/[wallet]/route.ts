/**
 * GET /api/research/author/[wallet]
 *
 * Aggregate view of one author's research: every paper they've published, plus
 * total tick/cross counts. Author identity (name + X handle) is pulled from
 * their most recent paper, since those fields can drift between submissions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

// Solana addresses are base58, 32–44 chars. Cheap shape-check; we don't need
// to verify on-chain validity here.
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> },
) {
  try {
    const { wallet } = await params;

    if (!WALLET_RE.test(wallet)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const papers = await ResearchPaper.find({
      authorWallet: wallet,
      status: 'active',
    })
      .sort({ createdAt: -1 })
      .lean<any[]>();

    if (!papers || papers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No research found for that wallet',
        },
        { status: 404 },
      );
    }

    const totalLikes = papers.reduce((sum, p) => sum + (p.likeCount || 0), 0);
    const totalDislikes = papers.reduce(
      (sum, p) => sum + (p.dislikeCount || 0),
      0,
    );

    // Identity from the most recent paper — authors may polish their byline
    // over time, and the latest take is closer to current truth.
    const latest = papers[0];

    return NextResponse.json({
      success: true,
      data: {
        wallet,
        displayName: latest.authorName,
        xHandle: latest.authorXHandle || null,
        paperCount: papers.length,
        totalLikes,
        totalDislikes,
        firstPublishedAt: papers[papers.length - 1]?.createdAt || null,
        latestPublishedAt: latest.createdAt || null,
        papers: papers.map((p) => ({
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
      },
    });
  } catch (error) {
    logger.error('[research/author] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load author' },
      { status: 500 },
    );
  }
}
