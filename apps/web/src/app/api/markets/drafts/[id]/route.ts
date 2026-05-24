// GET /api/markets/drafts/[id]
//
// Fetches an agent-prepared market draft. Used by the /create page on
// mount to pre-fill the form from a `?draft=<id>` query param. Drafts
// expire after 24h via Mongo's TTL index -- a stale id returns 404
// rather than partially-stale data.

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, MarketDraft } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id;
    if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
      return NextResponse.json(
        { success: false, error: 'invalid draft id' },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const draft = await MarketDraft.findById(id).lean();
    if (!draft) {
      return NextResponse.json(
        { success: false, error: 'draft not found or expired' },
        { status: 404 },
      );
    }

    // Belt-and-braces TTL check in case the Mongo monitor hasn't reaped
    // yet (TTL has ~60s tolerance).
    if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'draft expired' },
        { status: 410 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(draft._id),
        payload: draft.payload,
        provenance: draft.provenance,
        source: draft.source,
        createdAt: draft.createdAt,
        expiresAt: draft.expiresAt,
      },
    });
  } catch (error) {
    logger.error('[drafts/[id]] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: 'internal',
        stack: process.env.NODE_ENV !== 'production' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
