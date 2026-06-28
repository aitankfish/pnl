/**
 * POST /api/auth/device/poll
 *
 * Public (called by the terminal): exchange a device_code for status, and — the
 * first time it sees the grant approved — the device token. The plaintext token
 * is returned exactly once here and only its hash is stored; a second poll after
 * issuance won't re-hand it out.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, DeviceGrant } from '@/lib/mongodb';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import {
  generateDeviceToken,
  sha256,
  TOKEN_TTL_MS,
} from '@/lib/auth/device-auth';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    // Terminals poll every ~5s; allow that but cap abuse.
    const rateLimited = await checkRateLimit(`device-poll:${ip}`, 120, 10 * 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => ({}));
    const deviceCode = typeof body?.deviceCode === 'string' ? body.deviceCode : '';
    if (!deviceCode) return bad('Missing device code');

    await connectToDatabase();
    const grant = await DeviceGrant.findOne({ deviceCodeHash: sha256(deviceCode) });
    if (!grant) return NextResponse.json({ success: true, data: { status: 'not_found' } });

    // Pending window elapsed without approval.
    if (grant.status === 'pending' && grant.expiresAt.getTime() < Date.now()) {
      grant.status = 'expired';
      await grant.save();
      return NextResponse.json({ success: true, data: { status: 'expired' } });
    }

    if (grant.status === 'pending') {
      return NextResponse.json({ success: true, data: { status: 'pending' } });
    }
    if (grant.status === 'denied') {
      return NextResponse.json({ success: true, data: { status: 'denied' } });
    }
    if (grant.status === 'expired') {
      return NextResponse.json({ success: true, data: { status: 'expired' } });
    }

    // Approved.
    if (grant.tokenHash) {
      // Token already handed out once — never re-issue it.
      return NextResponse.json({ success: true, data: { status: 'approved', alreadyClaimed: true } });
    }

    // Mint atomically: the `tokenHash absent` precondition lets exactly one
    // concurrent poll win, so a retry/race can never get a second live token.
    const token = generateDeviceToken();
    const now = new Date();
    const issued = await DeviceGrant.findOneAndUpdate(
      { _id: grant._id, status: 'approved', tokenHash: { $exists: false } },
      {
        $set: {
          tokenHash: sha256(token),
          tokenIssuedAt: now,
          tokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
        },
      },
      { new: true },
    );
    if (!issued) {
      // Lost the race — another poll already issued the one token for this grant.
      return NextResponse.json({ success: true, data: { status: 'approved', alreadyClaimed: true } });
    }

    logger.info('[device/poll] token issued', { grantId: String(issued._id), wallet: issued.walletAddress });
    return NextResponse.json({
      success: true,
      data: {
        status: 'approved',
        token,
        walletAddress: issued.walletAddress,
        expiresAt: issued.tokenExpiresAt,
      },
    });
  } catch (error) {
    logger.error('[device/poll] failed', error as any);
    return NextResponse.json({ success: false, error: 'Poll failed' }, { status: 500 });
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
