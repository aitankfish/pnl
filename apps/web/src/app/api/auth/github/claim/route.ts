/**
 * POST /api/auth/github/claim
 *
 * Authed: bind a freshly-completed GitHub App installation to the caller's
 * wallet, using their live PNL session. This is the robust path — it does NOT
 * depend on GitHub forwarding the install `state` to the Setup URL (which isn't
 * guaranteed, and breaks on a direct-from-GitHub install or an expired state).
 * The browser that lands on the post-install page is already signed in, so we
 * bind from the session.
 *
 * Same one-installation-per-wallet invariant as the callback: the upsert is
 * keyed by {installationId, walletAddress}, so the unique installationId index
 * rejects an attempt to claim an installation already bound to someone else.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, GithubInstallation } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { getGithubAppConfig, getInstallation, isValidInstallationId } from '@/lib/github-app';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const POST = withAuth(async (request: NextRequest, authUser) => {
  try {
    const cfg = getGithubAppConfig();
    if (!cfg) return bad('GitHub is not configured on this deployment', 503);

    const rateLimited = await checkRateLimit(`github-claim:${authUser.walletAddress}`, 15, 10 * 60_000);
    if (rateLimited) return rateLimited;

    const json = await request.json().catch(() => ({}));
    const installationId = String(json?.installationId || '');
    if (!isValidInstallationId(installationId)) return bad('Invalid installation id');

    const info = await getInstallation(cfg, installationId);
    if (!info) return bad('Installation not found — it may have been removed', 404);

    await connectToDatabase();
    const now = new Date();
    await GithubInstallation.findOneAndUpdate(
      { installationId, walletAddress: authUser.walletAddress },
      {
        $set: { accountLogin: info.accountLogin, accountType: info.accountType, status: 'active', updatedAt: now },
        $setOnInsert: { walletAddress: authUser.walletAddress, installationId, createdAt: now },
      },
      { upsert: true },
    );

    logger.info('[github/claim] bound', { wallet: authUser.walletAddress, account: info.accountLogin });
    return NextResponse.json({ success: true, data: { accountLogin: info.accountLogin } });
  } catch (error: any) {
    // Duplicate-key = the installation is already bound to a different wallet.
    if (error?.code === 11000) {
      return bad('That installation is already linked to another account', 409);
    }
    logger.error('[github/claim] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to link installation' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
