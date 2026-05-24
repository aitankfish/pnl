// POST /api/mcp/rpc
//
// JSON-RPC proxy to our paid Helius endpoint. The MCP server uses this
// by default (zero-setup for the user) so autosign tx flows don't 429
// against the public Solana RPC. Power users override with PNL_RPC_URL.
//
// Rate limits:
//   - Read methods: 60/min per IP. Generous because read traffic is
//     cheap and necessary for tx-builds + balance checks + confirmation
//     polling.
//   - sendTransaction: 10/min per IP. Tighter because each one consumes
//     a paid Helius send credit and is the obvious abuse vector.
//   - Anything not in the allowlist: rejected.
//
// We don't add signature-auth here. The cost of an abusive caller is
// bounded by the rate limit, and gating the RPC behind a Solana
// signature adds friction without raising the abuse ceiling (an
// attacker can generate keypairs for free).

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

// Allowed JSON-RPC methods. Read methods + the single write the MCP
// needs (sendTransaction). Anything else is rejected so we don't
// proxy arbitrary methods that might be more expensive on Helius.
const READ_METHODS = new Set([
  'getAccountInfo',
  'getBalance',
  'getBlockHeight',
  'getEpochInfo',
  'getFeeForMessage',
  'getLatestBlockhash',
  'getMinimumBalanceForRentExemption',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getRecentPrioritizationFees',
  'getSignatureStatuses',
  'getSlot',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getTransaction',
  'getVersion',
  'isBlockhashValid',
  'simulateTransaction',
]);
const WRITE_METHODS = new Set(['sendTransaction']);

function resolveHeliusUrl(): string | null {
  const direct = process.env.HELIUS_MAINNET_RPC?.trim();
  if (direct) return direct;
  const apiKey = process.env.HELIUS_API_KEY?.trim();
  if (apiKey) return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  return null;
}

export async function POST(request: NextRequest) {
  const heliusUrl = resolveHeliusUrl();
  if (!heliusUrl) {
    logger.error('[mcp/rpc] no upstream RPC configured (HELIUS_MAINNET_RPC or HELIUS_API_KEY)');
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

  const isRead = READ_METHODS.has(method);
  const isWrite = WRITE_METHODS.has(method);
  if (!isRead && !isWrite) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: body.id ?? null, error: { code: -32601, message: `method '${method}' not allowed on this proxy` } },
      { status: 400 },
    );
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limited = isWrite
    ? await checkRateLimit(`mcp-rpc-write:${ip}`, 10, 60_000)
    : await checkRateLimit(`mcp-rpc-read:${ip}`, 60, 60_000);
  if (limited) return limited;

  // Forward the entire request (jsonrpc + id + method + params) so
  // Helius returns the response with the caller's id preserved.
  let upstream: Response;
  try {
    upstream = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, method, params: body.params ?? [] }),
    });
  } catch (error) {
    logger.error('[mcp/rpc] upstream fetch failed', { method, error: error instanceof Error ? error.message : String(error) });
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
