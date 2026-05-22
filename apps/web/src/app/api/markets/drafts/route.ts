// POST /api/markets/drafts
//
// Stores an agent-prepared market draft. The MCP server (or any
// external pitch tool) POSTs the payload here, receives a draft id,
// and hands the user a /create?draft=<id> deep-link. The /create
// page reads the draft on mount and pre-fills the form. The user
// still signs the actual on-chain transaction in their browser
// wallet -- drafts never replace the user's signature.
//
// No auth: anyone can create a draft. Rate-limited (60/min per IP)
// to prevent metadata-spam from cheap callers.

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, MarketDraft } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

// Bound the size of a draft so MCP callers can't push large blobs into Mongo.
const MAX_PAYLOAD_BYTES = 16 * 1024; // 16 KB is plenty for a name/desc + metadata

interface DraftRequestBody {
  payload?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  creatorWallet?: string;
  source?: string;
}

function isMissing(payload: Record<string, unknown>, key: string): boolean {
  const v = payload[key];
  return v == null || (typeof v === 'string' && v.trim().length === 0);
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResponse = checkRateLimit(`mcp-drafts:${ip}`, 60, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    const body = (await request.json()) as DraftRequestBody;
    if (!body || typeof body !== 'object' || !body.payload || typeof body.payload !== 'object') {
      return NextResponse.json(
        { success: false, error: 'payload is required' },
        { status: 400 },
      );
    }

    // Required fields for a usable pre-fill on /create. Validation matches
    // the Project schema constraints loosely -- the /create page's own
    // validator does the strict pass before submission.
    const missing: string[] = [];
    for (const field of ['name', 'description', 'category', 'projectType', 'projectStage', 'tokenSymbol', 'teamSize']) {
      if (isMissing(body.payload, field)) missing.push(field);
    }
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `missing required field(s): ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    const serialized = JSON.stringify(body.payload);
    if (serialized.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: `payload too large (max ${MAX_PAYLOAD_BYTES} bytes)` },
        { status: 413 },
      );
    }

    await connectToDatabase();
    const draft = await MarketDraft.create({
      creatorWallet: body.creatorWallet,
      source: body.source || 'mcp',
      payload: body.payload,
      provenance: body.provenance,
    });

    logger.info('[drafts] stored', {
      draftId: draft._id.toString(),
      source: draft.source,
      hasProvenance: !!body.provenance,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';
    return NextResponse.json({
      success: true,
      draftId: draft._id.toString(),
      deepLink: `${baseUrl}/create?draft=${draft._id.toString()}`,
      expiresAt: draft.expiresAt,
    });
  } catch (error) {
    logger.error('[drafts] POST failed', {
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
