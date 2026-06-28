/**
 * POST /api/auth/device/start
 *
 * Public (called by a terminal/MCP): begin device authorization. Returns a
 * device_code (the terminal's secret, polled with) + a user_code (shown to the
 * user) + the verification URL to open in a browser. Nothing is authenticated
 * yet — approval happens in the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, DeviceGrant } from '@/lib/mongodb';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import {
  generateDeviceCode,
  generateUserCode,
  sha256,
  PENDING_TTL_MS,
  POLL_INTERVAL_SECONDS,
} from '@/lib/auth/device-auth';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimited = await checkRateLimit(`device-start:${ip}`, 20, 10 * 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === 'string' ? body.label.slice(0, 120) : undefined;

    await connectToDatabase();

    const deviceCode = generateDeviceCode();
    // Avoid a user_code collision among still-pending grants (tiny chance).
    let userCode = generateUserCode();
    for (let i = 0; i < 3; i++) {
      const clash = await DeviceGrant.findOne({ userCode, status: 'pending' }).select('_id').lean();
      if (!clash) break;
      userCode = generateUserCode();
    }

    const now = new Date();
    await DeviceGrant.create({
      deviceCodeHash: sha256(deviceCode),
      userCode,
      status: 'pending',
      label,
      expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
      createdAt: now,
    });

    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
    logger.info('[device/start] grant created', { userCode });

    return NextResponse.json({
      success: true,
      data: {
        deviceCode,
        userCode,
        verificationUri: `${origin}/link`,
        verificationUriComplete: `${origin}/link?code=${encodeURIComponent(userCode)}`,
        expiresIn: Math.floor(PENDING_TTL_MS / 1000),
        interval: POLL_INTERVAL_SECONDS,
      },
    });
  } catch (error) {
    logger.error('[device/start] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to start device authorization' }, { status: 500 });
  }
}
