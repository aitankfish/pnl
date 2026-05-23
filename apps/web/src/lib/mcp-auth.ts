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
import { createHash } from 'node:crypto';

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
  payloadHash?: string,
): string {
  // When payloadHash is provided, fold it into the canonical challenge.
  // This binds the sig to the request body — an attacker who captures
  // a sig within the 5min nonce window cannot rewrite the body fields
  // (project name, vote type, amount, etc.) without invalidating the
  // sig. All mutating endpoints (complete-*) require a payloadHash.
  if (payloadHash) {
    return `pnl-mcp:${kind}:${fingerprint}:${payloadHash}:${nonce}`;
  }
  return `pnl-mcp:${kind}:${fingerprint}:${nonce}`;
}

/** Canonical JSON: keys sorted, no whitespace, recursive. Matches
 *  JSON.stringify's handling of `undefined` (drop keys / nulls in
 *  arrays) so both sides hash the same bytes whether they see a body
 *  pre- or post-JSON-roundtrip. */
function canonicalJson(value: unknown): string {
  // `undefined` as a top-level array element → `null` (matches JSON.stringify)
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  // Drop undefined-valued keys entirely. JSON.stringify does the same,
  // so a body that round-trips through fetch arrives identically to the
  // one we hashed on the client.
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') +
    '}'
  );
}

/** SHA-256 hash (first 16 hex chars) of the request body's payload
 *  fields. Auth fields (walletAddress / nonce / signature) are excluded
 *  so the hash represents what the user is *committing to* — not the
 *  envelope. Both client + server compute this the same way. */
export function signedRequestHash(body: Record<string, unknown>): string {
  const { walletAddress: _w, nonce: _n, signature: _s, ...payload } = body;
  void _w; void _n; void _s;
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex').slice(0, 16);
}
