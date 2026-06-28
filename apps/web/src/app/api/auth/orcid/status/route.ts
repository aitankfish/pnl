/**
 * GET /api/auth/orcid/status
 *
 * Authed: the caller's own ORCID link state + whether ORCID is configured on
 * this deployment (so the UI can show "connect" vs "coming soon").
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserProfile } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { isConfigured } from '@/lib/orcid';

export const GET = withAuth(async (_request: NextRequest, authUser) => {
  await connectToDatabase();
  const profile = await UserProfile.findOne({ walletAddress: authUser.walletAddress })
    .select('orcidId orcidName orcidVerifiedAt')
    .lean<any>();
  return NextResponse.json({
    success: true,
    data: {
      configured: isConfigured(),
      orcidId: profile?.orcidId || null,
      orcidName: profile?.orcidName || null,
      verifiedAt: profile?.orcidVerifiedAt || null,
    },
  });
});
