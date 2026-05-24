/**
 * Admin: broadcast a notification to all known users.
 *
 * The notification system is per-wallet (`/api/notifications?wallet=X`
 * queries `{ userId: wallet }`), so a platform-wide announcement —
 * e.g. "upgrade the MCP server, security fix" — has to fan out: one
 * notification row per known wallet. This endpoint does that, gated to
 * the treasury admin.
 *
 * Idempotent via `dedupeKey`: every fanned-out row stores it in
 * metadata, and re-running with the same key skips wallets that
 * already received it. So a flaky run can be safely retried, and the
 * same advisory won't double-post.
 *
 * Reaches EXISTING users (anyone with a UserProfile). New signups after
 * the broadcast won't get it — fine for time-sensitive advisories,
 * since the target is people who already used the affected version.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Notification, UserProfile } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { withAdmin } from '@/lib/auth/require-wallet';

const logger = createClientLogger();

const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

export const POST = withAdmin(async (request, adminUser) => {
  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const priority = VALID_PRIORITIES.has(body.priority) ? body.priority : 'high';
    const actionUrl = typeof body.actionUrl === 'string' ? body.actionUrl : undefined;
    const dedupeKey = typeof body.dedupeKey === 'string' ? body.dedupeKey.trim() : '';

    if (!title || !message || !dedupeKey) {
      return NextResponse.json(
        { success: false, error: 'title, message, and dedupeKey are required' },
        { status: 400 },
      );
    }
    if (title.length > 255 || message.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'title ≤255 chars, message ≤1000 chars' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // All distinct wallets with a profile. distinct() is fine at this
    // scale; if the user base grows large, switch to a cursor + batched
    // inserts.
    const wallets: string[] = await UserProfile.distinct('walletAddress');
    const cleanWallets = wallets.filter((w) => typeof w === 'string' && w.length > 0);

    if (cleanWallets.length === 0) {
      return NextResponse.json({ success: true, total: 0, sent: 0, skipped: 0 });
    }

    // Which of these already got this exact advisory? Skip them.
    const already: string[] = await Notification.distinct('userId', {
      'metadata.dedupeKey': dedupeKey,
      userId: { $in: cleanWallets },
    });
    const alreadySet = new Set(already);
    const targets = cleanWallets.filter((w) => !alreadySet.has(w));

    if (targets.length === 0) {
      logger.info('Broadcast already delivered to all known wallets', { dedupeKey });
      return NextResponse.json({
        success: true,
        total: cleanWallets.length,
        sent: 0,
        skipped: cleanWallets.length,
        dedupeKey,
      });
    }

    const now = new Date();
    const docs = targets.map((wallet) => ({
      userId: wallet,
      type: 'announcement',
      title,
      message,
      priority,
      actionUrl,
      isRead: false,
      metadata: { dedupeKey, broadcast: true },
      createdAt: now,
    }));

    await Notification.insertMany(docs, { ordered: false });

    logger.info('Broadcast notification fanned out', {
      dedupeKey,
      sent: targets.length,
      skipped: alreadySet.size,
      total: cleanWallets.length,
      by: adminUser.walletAddress,
    });

    return NextResponse.json({
      success: true,
      total: cleanWallets.length,
      sent: targets.length,
      skipped: alreadySet.size,
      dedupeKey,
    });
  } catch (error) {
    logger.error('Broadcast notification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to broadcast notification' },
      { status: 500 },
    );
  }
});
