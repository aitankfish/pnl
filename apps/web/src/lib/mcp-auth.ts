// ─── MCP signature authentication ────────────────────────────────
//
// Shared signature-verification helper used by /api/mcp/* endpoints
// that mutate state on behalf of an MCP-onboarded user. The MCP
// server signs a canonical challenge string with the local Solana
// keypair; the backend verifies the signature is good for the
// claimed wallet address.
//
// Trust model: knowledge of the private key = ability to mutate this
// wallet's PNL state. Same model as on-chain transactions; we're
// just extending it to backend writes (profile, market metadata)
// that don't have a corresponding Solana instruction.
//
// Nonce freshness (5 minute window) prevents replay of an old
// signed payload. Challenge format is per-endpoint so a signature
// captured for one endpoint can't be replayed against another.

import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const NONCE_MAX_AGE_MS = 5 * 60 * 1000;
const NONCE_CLOCK_SKEW_MS = 60 * 1000;

export interface SignedRequest {
  walletAddress: string;
  nonce: string;       // <unix-ms>-<hex>
  signature: string;   // base58 ed25519 signature
}

export type VerifyResult =
  | { ok: true; pubkey: PublicKey }
  | { ok: false; status: 400 | 401; reason: string };

function parseNonceMs(nonce: string): number | null {
  const dash = nonce.indexOf('-');
  if (dash < 1) return null;
  const ms = Number(nonce.slice(0, dash));
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

/**
 * Verify that `signature` is an ed25519 signature by `walletAddress`
 * over `challenge`. Caller constructs the challenge string from
 * endpoint-specific inputs so a sig for endpoint A can't be replayed
 * against endpoint B.
 *
 *   const result = verifyMcpSignature({
 *     walletAddress: body.walletAddress,
 *     nonce: body.nonce,
 *     signature: body.signature,
 *   }, `pnl-build-create-market-tx:${ipfsCid}:${nonce}`);
 *
 * On failure, the result includes an HTTP status hint so the
 * route handler can NextResponse.json(...).
 */
export function verifyMcpSignature(req: SignedRequest, challenge: string): VerifyResult {
  if (!req.walletAddress || !req.nonce || !req.signature) {
    return { ok: false, status: 400, reason: 'walletAddress, nonce, and signature are required' };
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(req.walletAddress);
  } catch {
    return { ok: false, status: 400, reason: 'walletAddress is not a valid base58 Solana public key' };
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = bs58.decode(req.signature);
  } catch {
    return { ok: false, status: 400, reason: 'signature is not valid base58' };
  }
  if (signatureBytes.length !== 64) {
    return { ok: false, status: 400, reason: 'signature must be a 64-byte ed25519 signature' };
  }

  const nonceMs = parseNonceMs(req.nonce);
  if (nonceMs == null) {
    return { ok: false, status: 400, reason: 'nonce must be in the form "<unix-ms>-<hex>"' };
  }
  const age = Date.now() - nonceMs;
  if (age > NONCE_MAX_AGE_MS || age < -NONCE_CLOCK_SKEW_MS) {
    return { ok: false, status: 401, reason: 'nonce expired — generate a fresh one and re-sign' };
  }

  const messageBytes = new TextEncoder().encode(challenge);
  const ok = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkey.toBytes());
  if (!ok) {
    return { ok: false, status: 401, reason: 'signature does not verify for this wallet' };
  }

  return { ok: true, pubkey };
}

/** Build a canonical challenge string. Centralized so the MCP side
 *  and the backend stay in lockstep — any drift between the two
 *  causes verification to fail loudly. */
export function challenge(
  kind:
    | 'build-create'
    | 'build-vote'
    | 'build-claim'
    | 'complete-create'
    | 'complete-vote'
    | 'complete-claim'
    | 'profile',
  fingerprint: string,
  nonce: string,
): string {
  return `pnl-mcp:${kind}:${fingerprint}:${nonce}`;
}
