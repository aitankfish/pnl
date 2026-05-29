// POST /api/rpc?cluster=mainnet|devnet
//
// JSON-RPC proxy to our paid Helius endpoint, for the WEB client's Privy
// wallet. Privy's react-auth SDK can only submit transactions through the
// RPC configured at the provider level (config.solana.rpcs) — unlike the
// mobile/expo SDK, it accepts no per-call connection. Pointing that config
// straight at the public Solana RPC made `sendTransaction` return HTTP 403
// (Solana error 8100002), so signing flows failed. Pointing it at our raw
// Helius URL fixes sends but (a) ships the key in the browser bundle and
// (b) lets Privy's SDK call Helius's expensive enhanced/DAS methods in the
// background — the ~1M-credits/month burn that commit 8ce2119 removed.
//
// This proxy threads that needle: standard JSON-RPC (sendTransaction,
// getBalance, getLatestBlockhash, simulateTransaction, ...) is forwarded to
// Helius using the SERVER-SIDE key, while the expensive Helius-proprietary
// methods are rejected. So sends are reliable AND the burn cannot recur,
// regardless of what a future Privy version decides to poll.
//
// Policy is a DENYLIST, not an allowlist: Privy calls an open-ended set of
// standard read methods we don't want to chase, and an unlisted standard
// method is cheap on Helius. We only block the methods that actually cost
// (DAS / compression / enhanced fee estimation) plus the obvious write.
//
// Rate limits (per IP):
//   - sendTransaction: 20/min — each consumes a paid send credit.
//   - everything else: 200/min — generous so Privy's balance/blockhash
//     polling and users behind a shared NAT don't trip it.
//
// No signature-auth (same reasoning as /api/mcp/rpc): the cost of abuse is
// bounded by the rate limit, and an attacker can mint keypairs for free, so
// gating on a signature adds friction without raising the abuse ceiling.
// Privy's SDK also can't attach our app JWT to these calls.

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

// Helius-proprietary / expensive JSON-RPC methods. Everything NOT in here is
// forwarded. The enhanced "wallettransfers" feature is a REST endpoint
// (/v0/addresses/.../transactions), not JSON-RPC, so it can never match a
// POST body here in the first place — these are the JSON-RPC cost centers.
const DENIED_METHODS = new Set([
  // Digital Asset Standard (DAS) API — the pricey ones.
  'getAsset',
  'getAssets',
  'getAssetProof',
  'getAssetProofs',
  'getAssetsByOwner',
  'getAssetsByAuthority',
  'getAssetsByCreator',
  'getAssetsByGroup',
  'getAssetSignatures',
  'getSignaturesForAsset',
  'searchAssets',
  'getNftEditions',
  'getTokenAccounts', // DAS variant (getTokenAccountsByOwner stays allowed)
  // Compression.
  'getCompressedAccount',
  'getCompressedBalance',
  'getCompressedTokenAccountsByOwner',
  'getCompressedAccountsByOwner',
  'getCompressedTokenAccountBalance',
  // Helius enhanced fee estimation.
  'getPriorityFeeEstimate',
]);

const WRITE_METHODS = new Set(['sendTransaction']);

// Lower-cased mirrors so the method filter can't be bypassed by case (e.g.
// "getassetsbyowner"). Solana RPC method names are case-sensitive upstream,
// but we don't want to rely on Helius rejecting a near-miss spelling.
const DENIED_LOWER = new Set([...DENIED_METHODS].map((m) => m.toLowerCase()));
const WRITE_LOWER = new Set([...WRITE_METHODS].map((m) => m.toLowerCase()));

/**
 * Same-origin guard. /api/rpc is only ever called by Privy's SDK from the
 * app's own browser context, which always sends an `Origin` header on POST.
 * We require that Origin's host to match the request Host, so the relay can't
 * be driven by a plain script/curl (no Origin) or another site (cross-origin)
 * to burn our paid Helius credits. Works across envs (localhost, preview,
 * prod) since it compares against the request's own host rather than a
 * hard-coded domain. This is defense-in-depth; the primary control is a
 * Cloudflare rate-limit rule on /api/rpc*. Origin can be spoofed by a
 * determined attacker, but this removes the trivial open-relay path.
 */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function resolveHeliusUrl(cluster: 'mainnet' | 'devnet'): string | null {
  // Prefer an explicit server-side URL if configured, else build one from
  // the bare API key. These are SERVER env vars (no NEXT_PUBLIC_) so the key
  // never reaches the browser through this path.
  const explicit =
    cluster === 'mainnet'
      ? process.env.HELIUS_MAINNET_RPC?.trim()
      : process.env.HELIUS_DEVNET_RPC?.trim();
  if (explicit) return explicit;

  const apiKey = process.env.HELIUS_API_KEY?.trim();
  if (apiKey) {
    const host = cluster === 'mainnet' ? 'mainnet.helius-rpc.com' : 'devnet.helius-rpc.com';
    return `https://${host}/?api-key=${apiKey}`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'cross-origin requests are not allowed' } },
      { status: 403 },
    );
  }

  const clusterParam = request.nextUrl.searchParams.get('cluster');
  const cluster: 'mainnet' | 'devnet' = clusterParam === 'devnet' ? 'devnet' : 'mainnet';

  const heliusUrl = resolveHeliusUrl(cluster);
  if (!heliusUrl) {
    logger.error('[api/rpc] no upstream RPC configured', { cluster });
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'RPC proxy is not configured on this deploy' } },
      { status: 503 },
    );
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } },
      { status: 400 },
    );
  }
  const method = typeof body.method === 'string' ? body.method : '';
  if (!method) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: body.id ?? null, error: { code: -32600, message: 'invalid request: missing method' } },
      { status: 400 },
    );
  }

  const methodLower = method.toLowerCase();
  if (DENIED_LOWER.has(methodLower)) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: body.id ?? null, error: { code: -32601, message: `method '${method}' not allowed on this proxy` } },
      { status: 400 },
    );
  }

  const isWrite = WRITE_LOWER.has(methodLower);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limited = isWrite
    ? await checkRateLimit(`web-rpc-write:${ip}`, 20, 60_000)
    : await checkRateLimit(`web-rpc-read:${ip}`, 120, 60_000);
  if (limited) return limited;

  // Forward the request verbatim (jsonrpc + id + method + params) so Helius
  // returns the response with the caller's id preserved.
  let upstream: Response;
  try {
    upstream = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, method, params: body.params ?? [] }),
    });
  } catch (error) {
    logger.error('[api/rpc] upstream fetch failed', {
      cluster,
      method,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { jsonrpc: '2.0', id: body.id ?? null, error: { code: -32603, message: 'upstream RPC unreachable' } },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
