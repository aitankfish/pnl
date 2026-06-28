/**
 * POST /api/auth/device/approve
 *
 * Authed (Privy, in the browser): approve or deny a pending device grant by its
 * user_code. Approval binds the grant to the *approver's verified wallet*, so a
 * device token can only ever act as the person who approved it. The token
 * itself is minted later, on the terminal's next poll.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, DeviceGrant } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { normalizeUserCode } from '@/lib/auth/device-auth';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export const POST = withAuth(async (request: NextRequest, authUser) => {
  try {
    // Tight — guessing a live user_code is the main attack on this endpoint.
    const rateLimited = await checkRateLimit(`device-approve:${authUser.walletAddress}`, 20, 10 * 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => ({}));
    const userCode = normalizeUserCode(String(body?.userCode || ''));
    // Must be an explicit boolean — a malformed/empty body must never count as
    // an approval (binding a terminal is one-way and hard to reverse).
    if (typeof body?.approve !== 'boolean') return bad('approve must be true or false');
    const approve = body.approve;
    const label = typeof body?.label === 'string' ? body.label.slice(0, 120) : undefined;
    if (!userCode) return bad('Enter the code shown in your terminal');

    await connectToDatabase();
    const grant = await DeviceGrant.findOne({ userCode, status: 'pending' });
    if (!grant) return bad('That code isn’t valid (it may have expired or already been used)', 404);

    if (grant.expiresAt.getTime() < Date.now()) {
      grant.status = 'expired';
      await grant.save();
      return bad('That code has expired — start again from your terminal', 410);
    }

    if (!approve) {
      grant.status = 'denied';
      await grant.save();
      return NextResponse.json({ success: true, data: { status: 'denied' } });
    }

    grant.status = 'approved';
    grant.walletAddress = authUser.walletAddress;
    grant.userId = authUser.userId;
    grant.email = authUser.email;
    grant.approvedAt = new Date();
    if (label) grant.label = label;
    await grant.save();

    logger.info('[device/approve] approved', { userCode, wallet: authUser.walletAddress });
    return NextResponse.json({ success: true, data: { status: 'approved', label: grant.label || null } });
  } catch (error) {
    logger.error('[device/approve] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to approve device' }, { status: 500 });
  }
});

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
