/**
 * POST /api/track — lightweight visit/view beacon (fire-and-forget).
 *
 * Called via navigator.sendBeacon from the browser: `platform_visit` once per
 * session, `market_view` on each market page. Records a daily counter tagged
 * human/agent. ALWAYS returns 204 and never throws — a beacon must never
 * surface an error (or a 429) to the page. See lib/services/metrics-service.
 */

import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { recordMetric, actorFromRequest } from '@/lib/services/metrics-service';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const logger = createClientLogger();
const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  // Generous cap — a human browsing fires a handful/min. Over-limit is swallowed
  // silently (a beacon should never see a 429).
  const limited = await checkRateLimit(`track:${ip}`, 120, 60_000);
  if (limited) return noContent();

  try {
    // sendBeacon posts a Blob; read as text then parse so any content-type works.
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const actor = actorFromRequest(req);
    if (body?.event === 'platform_visit') {
      await recordMetric('platform', 'visit', actor);
    } else if (
      body?.event === 'market_view' &&
      typeof body?.marketId === 'string' &&
      body.marketId.length > 0 &&
      body.marketId.length <= 80
    ) {
      await recordMetric('market', body.marketId, actor);
    }
    // Unknown events are silently ignored.
  } catch (e) {
    logger.error('[track] failed', e as any);
  }
  return noContent();
}
