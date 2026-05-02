/**
 * GET /api/research/citation-index
 *
 * Returns the set of marketAddresses (projects with ≥1 visible citation)
 * and paperIds (papers that visibly underpin ≥1 project). Powers the
 * "has thesis" / "cited" badges on /browse and the filter chips.
 *
 * Cached in Redis for 30s — short enough that newly-accepted citations
 * surface quickly, long enough to save a bunch of work for a browse
 * page that pretty much every authenticated user hits regularly.
 */

import { NextResponse } from 'next/server';
import {
  connectToDatabase,
  PaperCitation,
  PredictionMarket,
} from '@/lib/mongodb';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const CACHE_KEY = prefixKey('research:citation-index');
const CACHE_SECONDS = 30;

export async function GET() {
  try {
    // Cache hit?
    try {
      const redis = getRedisClient();
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }
    } catch (err) {
      logger.warn('[citation-index] redis read failed', {
        err: err instanceof Error ? err.message : String(err),
      } as any);
    }

    await connectToDatabase();

    const citations = await PaperCitation.find({
      status: { $in: ['auto', 'accepted'] },
    })
      .select('paperId projectId')
      .lean<any[]>();

    const projectIds = Array.from(
      new Set(citations.map((c) => String(c.projectId))),
    );
    const paperIds = Array.from(
      new Set(citations.map((c) => String(c.paperId))),
    );

    let marketAddresses: string[] = [];
    if (projectIds.length > 0) {
      const markets = await PredictionMarket.find({
        projectId: { $in: projectIds },
      })
        .select('marketAddress projectId')
        .lean<any[]>();
      marketAddresses = markets.map((m) => m.marketAddress).filter(Boolean);
    }

    const payload = {
      marketAddresses,
      paperIds,
      projectIds,
      total: citations.length,
      generatedAt: new Date().toISOString(),
    };

    try {
      const redis = getRedisClient();
      await redis.setex(CACHE_KEY, CACHE_SECONDS, JSON.stringify(payload));
    } catch (err) {
      logger.warn('[citation-index] redis write failed', {
        err: err instanceof Error ? err.message : String(err),
      } as any);
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    logger.error('[citation-index] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load citation index' },
      { status: 500 },
    );
  }
}
