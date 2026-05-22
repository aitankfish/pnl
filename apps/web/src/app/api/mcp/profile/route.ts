// POST /api/mcp/profile
//
// Lets an MCP-onboarded user claim or rename their PNL username
// without going through the browser. Auth model: the caller signs a
// challenge with their Solana keypair (the same keypair the MCP server
// holds locally). The backend verifies the signature against the
// claimed wallet address — proof of ownership, no Privy session
// required. Nonces are timestamped and rejected if older than 5
// minutes to prevent replay.
//
// Endpoint shape:
//   { walletAddress, username, nonce, signature } -> updates UserProfile.
// Returns 409 if the username is already taken by another wallet,
// 401 if the signature doesn't verify, 400 on malformed input.

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserProfile } from '@/lib/mongodb';
import { ensureUserProfile } from '@/lib/user-profile-init';
import { createClientLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

// Username constraints. Mirrors common social conventions: letters,
// numbers, underscores, hyphens. 3-20 chars.
const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

// Nonce TTL — the signed challenge is valid for 5 minutes. After that
// the user has to resign. Prevents an attacker who captures a signed
// payload from replaying it tomorrow.
const NONCE_MAX_AGE_MS = 5 * 60 * 1000;

interface ProfileClaimBody {
  walletAddress?: string;
  username?: string;
  nonce?: string;
  signature?: string; // base58
}

function buildChallenge(username: string, walletAddress: string, nonce: string): string {
  return `pnl-set-username:${username}:${walletAddress}:${nonce}`;
}

function parseNonceTimestamp(nonce: string): number | null {
  // Expected format: "<unix-ms>-<hex>". Tolerant — we only need the ms.
  const dash = nonce.indexOf('-');
  if (dash < 1) return null;
  const ms = Number(nonce.slice(0, dash));
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResponse = checkRateLimit(`mcp-profile:${ip}`, 20, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    const body = (await request.json()) as ProfileClaimBody;
    const walletAddress = body.walletAddress?.trim();
    const username = body.username?.trim();
    const nonce = body.nonce?.trim();
    const signatureB58 = body.signature?.trim();

    if (!walletAddress || !username || !nonce || !signatureB58) {
      return NextResponse.json(
        { success: false, error: 'walletAddress, username, nonce, and signature are required' },
        { status: 400 },
      );
    }

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { success: false, error: 'username must be 3-20 characters, letters/numbers/_/- only' },
        { status: 400 },
      );
    }

    // Validate wallet address and signature shape before any DB hit.
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json(
        { success: false, error: 'walletAddress is not a valid base58 Solana public key' },
        { status: 400 },
      );
    }

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = bs58.decode(signatureB58);
    } catch {
      return NextResponse.json(
        { success: false, error: 'signature is not valid base58' },
        { status: 400 },
      );
    }
    if (signatureBytes.length !== 64) {
      return NextResponse.json(
        { success: false, error: 'signature must be a 64-byte ed25519 signature' },
        { status: 400 },
      );
    }

    // Nonce freshness — keeps an old signed payload from being replayed.
    const nonceMs = parseNonceTimestamp(nonce);
    if (nonceMs == null) {
      return NextResponse.json(
        { success: false, error: 'nonce must be in the form "<unix-ms>-<hex>"' },
        { status: 400 },
      );
    }
    const age = Date.now() - nonceMs;
    if (age > NONCE_MAX_AGE_MS || age < -60_000 /* tolerate 1min clock skew */) {
      return NextResponse.json(
        { success: false, error: 'nonce expired — generate a fresh one and re-sign' },
        { status: 401 },
      );
    }

    // Verify the signature was produced by the claimed wallet over the
    // exact challenge string. tweetnacl's verifier is constant-time.
    const challenge = buildChallenge(username, walletAddress, nonce);
    const messageBytes = new TextEncoder().encode(challenge);
    const ok = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkey.toBytes());
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'signature does not verify for this wallet' },
        { status: 401 },
      );
    }

    await connectToDatabase();

    // Username uniqueness check — collision allowed only if the existing
    // holder is the requesting wallet (i.e. they're "renaming" to the
    // same name, no-op).
    const taken = await UserProfile.findOne({ username });
    if (taken && taken.walletAddress !== walletAddress) {
      return NextResponse.json(
        { success: false, error: 'username is already taken by another wallet' },
        { status: 409 },
      );
    }

    // ensureUserProfile creates a Cosmic-named profile if this wallet
    // is brand new. We then overwrite with the requested username.
    const profile = await ensureUserProfile(walletAddress, { source: 'mcp' });
    profile.username = username;
    await profile.save();

    logger.info('[mcp/profile] username updated', {
      walletAddress,
      username,
    });

    return NextResponse.json({
      success: true,
      data: {
        walletAddress: profile.walletAddress,
        username: profile.username,
        profilePhotoUrl: profile.profilePhotoUrl,
      },
    });
  } catch (error) {
    logger.error('[mcp/profile] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: 'internal',
        stack: process.env.NODE_ENV !== 'production' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
