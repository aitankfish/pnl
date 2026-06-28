/**
 * Device authorization helpers.
 *
 * Implements the terminal-binding half of the account spine: a terminal gets a
 * device_code + user_code, the user approves it in the browser (authenticated
 * via Privy), and the terminal exchanges its device_code for a PNL device token
 * that authenticates as the user's wallet on any `withAuth` endpoint.
 *
 * Secrets are stored HASHED (sha256). The plaintext device token is shown to
 * the terminal exactly once (on the poll that first sees the approval) and
 * never persisted in the clear.
 */

import crypto from 'crypto';
import { connectToDatabase, DeviceGrant } from '@/lib/mongodb';
import type { AuthenticatedUser } from '@/lib/auth/privy-server';

// Device tokens are prefixed so verifyAuth can route them without a DB hit on
// every Privy request.
export const DEVICE_TOKEN_PREFIX = 'pnl_dev_';

export const PENDING_TTL_MS = 15 * 60 * 1000; // approval window
export const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90-day device token
export const POLL_INTERVAL_SECONDS = 5;

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function generateDeviceCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateDeviceToken(): string {
  return DEVICE_TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
}

// Human-friendly code, e.g. "K7Q4-9F2M". Crockford-ish alphabet (no I/O/0/1 to
// avoid confusion); 8 chars over a 32-symbol alphabet ≈ 40 bits.
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateUserCode(): string {
  // crypto.randomInt does unbiased rejection sampling — no modulo bias even if
  // the alphabet length stops dividing 256.
  let s = '';
  for (let i = 0; i < 8; i++) s += USER_CODE_ALPHABET[crypto.randomInt(USER_CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeUserCode(input: string): string {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(.{4})/, '$1-$2');
}

export function isDeviceToken(token: string): boolean {
  return token.startsWith(DEVICE_TOKEN_PREFIX);
}

/**
 * Resolve a PNL device token to its bound user, or null. Only an `approved`
 * grant with a live (non-expired) token authenticates. Touches `lastUsedAt`
 * for session visibility. Never throws.
 */
export async function verifyDeviceToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    if (!isDeviceToken(token)) return null;
    await connectToDatabase();

    const tokenHash = sha256(token);
    const grant = await DeviceGrant.findOne({ tokenHash, status: 'approved' });
    if (!grant || !grant.walletAddress) return null;
    if (grant.tokenExpiresAt && grant.tokenExpiresAt.getTime() < Date.now()) return null;

    // Best-effort last-used stamp (don't block auth on the write).
    grant.lastUsedAt = new Date();
    grant.save().catch(() => {});

    return {
      userId: grant.userId || `device:${grant.walletAddress}`,
      walletAddress: grant.walletAddress,
      email: grant.email || undefined,
      createdAt: grant.createdAt || new Date(),
    };
  } catch {
    return null;
  }
}
