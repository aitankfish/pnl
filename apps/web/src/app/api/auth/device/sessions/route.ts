/**
 * GET  /api/auth/device/sessions  — authed: list the caller's linked terminals
 *       (approved device grants), so they can see and revoke them.
 * POST /api/auth/device/sessions  — authed: revoke one by id ({ revoke: id }).
 *       Revoking flips it to denied and clears the token hash, so the device
 *       token immediately stops authenticating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, DeviceGrant } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const GET = withAuth(async (_request: NextRequest, authUser) => {
  await connectToDatabase();
  const grants = await DeviceGrant.find({ walletAddress: authUser.walletAddress, status: 'approved' })
    .sort({ approvedAt: -1 })
    .limit(50)
    .lean<any[]>();
  return NextResponse.json({
    success: true,
    data: {
      sessions: grants.map((g) => ({
        id: String(g._id),
        label: g.label || null,
        approvedAt: g.approvedAt || null,
        lastUsedAt: g.lastUsedAt || null,
        expiresAt: g.tokenExpiresAt || null,
        active: !!g.tokenHash && (!g.tokenExpiresAt || g.tokenExpiresAt.getTime() > Date.now()),
      })),
    },
  });
});

export const POST = withAuth(async (request: NextRequest, authUser) => {
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body?.revoke || '');
    if (!Types.ObjectId.isValid(id)) return bad('Invalid session id');

    await connectToDatabase();
    const grant = await DeviceGrant.findById(id);
    // Ownership check — you can only revoke your own linked terminals.
    if (!grant || grant.walletAddress !== authUser.walletAddress) return bad('Session not found', 404);

    grant.status = 'denied';
    grant.tokenHash = undefined;
    await grant.save();
    logger.info('[device/sessions] revoked', { id, wallet: authUser.walletAddress });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    logger.error('[device/sessions] revoke failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to revoke' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
