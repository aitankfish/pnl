/**
 * GET /api/auth/github/status — authed: whether GitHub is configured on this
 * deployment + the caller's active installations (the GitHub accounts they've
 * connected, so they can cut releases on those repos).
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, GithubInstallation } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { isGithubAppConfigured } from '@/lib/github-app';

export const GET = withAuth(async (_request: NextRequest, authUser) => {
  await connectToDatabase();
  const installs = await GithubInstallation.find({ walletAddress: authUser.walletAddress, status: 'active' })
    .select('accountLogin accountType createdAt')
    .lean<any[]>();
  return NextResponse.json({
    success: true,
    data: {
      configured: isGithubAppConfigured(),
      installations: installs.map((i) => ({
        accountLogin: i.accountLogin,
        accountType: i.accountType || null,
        connectedAt: i.createdAt || null,
      })),
    },
  });
});
