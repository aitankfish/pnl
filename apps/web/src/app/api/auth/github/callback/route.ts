/**
 * GET /api/auth/github/callback
 *
 * GitHub redirects here after the user installs the PNL App, with
 * ?installation_id, ?setup_action & ?state. We resolve the wallet-bound state,
 * look up which GitHub account the installation belongs to, and record it so
 * PNL can mint scoped tokens to cut releases on that owner's repos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, GithubInstallation } from '@/lib/mongodb';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { getGithubAppConfig, getInstallation, isValidInstallationId } from '@/lib/github-app';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

function redirectTo(request: NextRequest, path: string) {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
  return NextResponse.redirect(new URL(path, origin));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get('installation_id');
  const state = searchParams.get('state');

  try {
    const cfg = getGithubAppConfig();
    if (!cfg) return redirectTo(request, '/?github=error&reason=unconfigured');
    // installation_id is attacker-controllable in this redirect URL — it must be
    // a plain integer before it ever reaches a GitHub request path.
    if (!installationId || !isValidInstallationId(installationId)) {
      return redirectTo(request, '/?github=error&reason=missing');
    }

    // State binds the install to the wallet that started it. (GitHub omits state
    // when a user installs from the App page directly, not via our start flow.)
    let wallet: string | null = null;
    if (state) {
      const redis = getRedisClient();
      const key = prefixKey(`ghstate:${state}`);
      wallet = await redis.get(key);
      await redis.del(key);
    }
    // No usable state (GitHub didn't forward it, it expired, or this was a
    // direct install from the App page) — hand off to the client page, which
    // binds the installation from the user's live session. installationId is
    // already validated as a plain integer above.
    if (!wallet) {
      return redirectTo(request, `/github/connected?installation_id=${installationId}`);
    }

    const info = await getInstallation(cfg, installationId);
    if (!info) return redirectTo(request, `/profile/${wallet}?github=error&reason=lookup`);

    await connectToDatabase();
    const now = new Date();
    // Key the upsert by installationId AND wallet. An attacker replaying a
    // victim's installation_id under their own state can't overwrite the
    // victim's binding: no match → insert attempt → the unique index on
    // installationId rejects it (duplicate-key → caught below → error redirect).
    await GithubInstallation.findOneAndUpdate(
      { installationId, walletAddress: wallet },
      {
        $set: {
          accountLogin: info.accountLogin,
          accountType: info.accountType,
          status: 'active',
          updatedAt: now,
        },
        $setOnInsert: { walletAddress: wallet, installationId, createdAt: now },
      },
      { upsert: true },
    );

    logger.info('[github/callback] installation recorded', { wallet, account: info.accountLogin });
    return redirectTo(request, `/profile/${wallet}?github=connected`);
  } catch (error) {
    logger.error('[github/callback] failed', error as any);
    return redirectTo(request, '/?github=error&reason=server');
  }
}
