/**
 * GET /api/admin/metrics — platform-wide visit/view analytics (admin only).
 *
 * Platform + market totals split human/agent, plus the top markets by views.
 * `?days=N` restricts the window (default: all time).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/require-wallet';
import { isPlatformAdmin } from '@/lib/admin';
import { platformMetrics, topMarkets } from '@/lib/services/metrics-service';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export const GET = withAuth(async (req: NextRequest, authUser) => {
  try {
    if (!isPlatformAdmin(authUser.walletAddress)) {
      return NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 });
    }
    const days = parseInt(new URL(req.url).searchParams.get('days') || '0', 10);
    const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
    const [totals, top] = await Promise.all([platformMetrics(since), topMarkets(20, since)]);
    return NextResponse.json({ success: true, data: { totals, topMarkets: top, windowDays: days || null } });
  } catch (error) {
    logger.error('[admin-metrics] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load metrics' }, { status: 500 });
  }
});
