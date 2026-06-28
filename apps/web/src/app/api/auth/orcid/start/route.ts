/**
 * POST /api/auth/orcid/start
 *
 * Authed: begin ORCID verification for the caller's wallet. We mint a
 * single-use, short-lived `state` bound to the wallet (the OAuth round-trip
 * leaves our app, so the wallet can't sign the callback — state carries the
 * binding) and return the ORCID authorize URL for the browser to navigate to.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { getOrcidConfig, buildAuthorizeUrl } from '@/lib/orcid';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const STATE_TTL = 10 * 60; // 10 minutes to complete the round-trip

export const POST = withAuth(async (request: NextRequest, authUser) => {
  try {
    const cfg = getOrcidConfig();
    if (!cfg) {
      return NextResponse.json({ success: false, error: 'ORCID is not configured on this deployment' }, { status: 503 });
    }

    const rateLimited = await checkRateLimit(`orcid-start:${authUser.walletAddress}`, 10, 10 * 60_000);
    if (rateLimited) return rateLimited;

    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
    const redirectUri = cfg.redirectUri || `${origin}/api/auth/orcid/callback`;

    const state = crypto.randomBytes(24).toString('hex');
    // Store the exact redirectUri too — the token exchange must reuse it
    // verbatim, and it must survive even if the callback host differs.
    await getRedisClient().setex(
      prefixKey(`orcidstate:${state}`),
      STATE_TTL,
      JSON.stringify({ wallet: authUser.walletAddress, redirectUri }),
    );

    const url = buildAuthorizeUrl(cfg, state, redirectUri);
    logger.info('[orcid/start] state issued', { wallet: authUser.walletAddress });
    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    logger.error('[orcid/start] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to start ORCID verification' }, { status: 500 });
  }
});
