/**
 * POST /api/auth/github/start
 *
 * Authed: begin installing the PNL GitHub App. Mints a wallet-bound state (the
 * install round-trip leaves the app) and returns the GitHub install URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { getGithubAppConfig, installUrl } from '@/lib/github-app';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const STATE_TTL = 15 * 60;

export const POST = withAuth(async (_request: NextRequest, authUser) => {
  try {
    const cfg = getGithubAppConfig();
    if (!cfg) {
      return NextResponse.json({ success: false, error: 'GitHub is not configured on this deployment' }, { status: 503 });
    }

    const rateLimited = await checkRateLimit(`github-start:${authUser.walletAddress}`, 10, 15 * 60_000);
    if (rateLimited) return rateLimited;

    const state = crypto.randomBytes(24).toString('hex');
    await getRedisClient().setex(prefixKey(`ghstate:${state}`), STATE_TTL, authUser.walletAddress);

    logger.info('[github/start] state issued', { wallet: authUser.walletAddress });
    return NextResponse.json({ success: true, data: { url: installUrl(cfg, state) } });
  } catch (error) {
    logger.error('[github/start] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to start GitHub install' }, { status: 500 });
  }
});
