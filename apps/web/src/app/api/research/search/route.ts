/**
 * GET /api/research/search?q=...&authorWallet=...&limit=...
 *
 * Autocomplete search for papers. Used by the create-project flow when a
 * founder is linking papers to their project. In Phase A this is filtered
 * to the requester's own papers (matching the same-wallet citation rule).
 *
 * If the optional `authorWallet` param is supplied, the search is scoped to
 * that author. We don't expose a fully open search yet to avoid spam in the
 * citation flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const authorWallet = (searchParams.get('authorWallet') || '').trim();
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '8', 10),
      20,
    );

    await connectToDatabase();

    const excludeAuthorWallet = (
      searchParams.get('excludeAuthorWallet') || ''
    ).trim();

    const filter: Record<string, any> = { status: 'active' };
    if (authorWallet) {
      if (!WALLET_RE.test(authorWallet)) {
        return NextResponse.json(
          { success: false, error: 'Invalid authorWallet' },
          { status: 400 },
        );
      }
      filter.authorWallet = authorWallet;
    } else if (excludeAuthorWallet) {
      if (!WALLET_RE.test(excludeAuthorWallet)) {
        return NextResponse.json(
          { success: false, error: 'Invalid excludeAuthorWallet' },
          { status: 400 },
        );
      }
      filter.authorWallet = { $ne: excludeAuthorWallet };
    }
    if (q) {
      // Case-insensitive substring on title; cheap for the small corpus
      // we'll have for a long time. Upgrade to a real text index later.
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escaped, $options: 'i' };
    }

    const papers = await ResearchPaper.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean<any[]>();

    return NextResponse.json({
      success: true,
      data: {
        results: papers.map((p) => ({
          id: String(p._id),
          title: p.title,
          authorName: p.authorName,
          authorWallet: p.authorWallet,
          authorXHandle: p.authorXHandle || null,
          summary: p.summary || null,
          paperUrl: convertToGatewayUrl(p.paperUrl) || p.paperUrl,
          currentVersion: p.currentVersion || 1,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt || p.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('[research/search] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 },
    );
  }
}
