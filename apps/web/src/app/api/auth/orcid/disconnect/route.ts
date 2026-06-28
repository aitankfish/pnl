/**
 * POST /api/auth/orcid/disconnect
 *
 * Authed: unlink the caller's ORCID iD from their profile. The iD is freed up
 * to verify another account afterward.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserProfile } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const POST = withAuth(async (_request: NextRequest, authUser) => {
  try {
    await connectToDatabase();
    await UserProfile.findOneAndUpdate(
      { walletAddress: authUser.walletAddress },
      { $unset: { orcidId: '', orcidName: '', orcidVerifiedAt: '' }, $set: { updatedAt: new Date() } },
    );
    logger.info('[orcid/disconnect] unlinked', { wallet: authUser.walletAddress });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[orcid/disconnect] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to disconnect ORCID' }, { status: 500 });
  }
});
