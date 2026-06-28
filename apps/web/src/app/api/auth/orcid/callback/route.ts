/**
 * GET /api/auth/orcid/callback
 *
 * The ORCID redirect lands here with ?code & ?state. We look up the
 * wallet-bound state, exchange the code for the verified ORCID iD, and write it
 * to that wallet's profile — server-side only, so the verified flag can never
 * be set by a client. One ORCID verifies at most one account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserProfile } from '@/lib/mongodb';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { getOrcidConfig, exchangeCode } from '@/lib/orcid';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

function redirectTo(request: NextRequest, path: string) {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
  return NextResponse.redirect(new URL(path, origin));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const denied = searchParams.get('error'); // user hit "deny" at ORCID

  try {
    const cfg = getOrcidConfig();
    if (!cfg) return redirectTo(request, '/?orcid=error&reason=unconfigured');

    if (denied || !code || !state) {
      return redirectTo(request, '/?orcid=error&reason=denied');
    }

    // Single-use state — pop it so a replay can't reuse the binding.
    const redis = getRedisClient();
    const key = prefixKey(`orcidstate:${state}`);
    const raw = await redis.get(key);
    await redis.del(key);
    if (!raw) return redirectTo(request, '/?orcid=error&reason=expired');

    const { wallet, redirectUri } = JSON.parse(raw) as { wallet: string; redirectUri: string };

    const token = await exchangeCode(cfg, code, redirectUri);
    if (!token) return redirectTo(request, `/profile/${wallet}?orcid=error&reason=exchange`);

    await connectToDatabase();

    // One ORCID → one account. If this iD already verifies a different wallet,
    // refuse rather than let it vouch for two identities.
    const existing = await UserProfile.findOne({ orcidId: token.orcid }).select('walletAddress').lean<any>();
    if (existing && existing.walletAddress !== wallet) {
      return redirectTo(request, `/profile/${wallet}?orcid=error&reason=taken`);
    }

    await UserProfile.findOneAndUpdate(
      { walletAddress: wallet },
      {
        $set: { orcidId: token.orcid, orcidName: token.name || undefined, orcidVerifiedAt: new Date(), updatedAt: new Date() },
        $setOnInsert: { walletAddress: wallet, createdAt: new Date() },
      },
      { upsert: true },
    );

    logger.info('[orcid/callback] verified', { wallet, orcid: token.orcid });
    return redirectTo(request, `/profile/${wallet}?orcid=connected`);
  } catch (error) {
    logger.error('[orcid/callback] failed', error as any);
    return redirectTo(request, '/?orcid=error&reason=server');
  }
}
