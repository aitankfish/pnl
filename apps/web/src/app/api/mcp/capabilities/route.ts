/**
 * GET /api/mcp/capabilities — a machine-readable manifest of what PNL offers
 * agents: the read/discovery API, the MCP server + its tools, auth methods, and
 * rate-limit signalling. One fetch lets an agent (or an agent-discovery registry)
 * learn the surface without scraping docs.
 *
 * This describes what ACTUALLY EXISTS today. Keep it truthful — no aspirational
 * endpoints. It's a static, cacheable document (no DB, no secrets).
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Grouped for readability; the flat list is the 19 pnl_* tools registered in
// apps/mcp/src/index.ts.
const MCP_TOOLS = {
  read: ['pnl_browse_markets', 'pnl_get_market', 'pnl_notify', 'pnl_wallet', 'pnl_help'],
  identity: ['pnl_set_username', 'pnl_login', 'pnl_logout'],
  wallet: ['pnl_init', 'pnl_unlock', 'pnl_lock', 'pnl_restore', 'pnl_export_keypair'],
  market_actions: ['pnl_pitch_idea', 'pnl_pitch_now', 'pnl_vote', 'pnl_vote_now', 'pnl_claim', 'pnl_claim_now'],
};

const CAPABILITIES = {
  name: 'PNL',
  tagline: 'Conviction markets for ideas on Solana. Agent-native.',
  docs: 'https://docs.pnl.market',
  llmsTxt: 'https://pnl.market/llms.txt',

  // Public, no-auth read surface. Responses use a { success, data } envelope;
  // errors add a stable `errorCode` (see errorCodes below).
  readApi: {
    baseUrl: 'https://pnl.market',
    auth: 'none',
    endpoints: [
      { method: 'GET', path: '/api/markets/list', description: 'Paginated market list. Query: status (active|yesWins|noWins|expired|refund|all), page, limit (1-100).' },
      { method: 'GET', path: '/api/markets/{id}', description: 'One market by Mongo id or on-chain address. Vote split is masked on unresolved markets by design.' },
      { method: 'GET', path: '/api/markets/batch?ids={csv}', description: 'Compact fetch for up to 40 ids at once.' },
      { method: 'GET', path: '/api/search?q={query}', description: 'Keyword search across markets and users.' },
    ],
  },

  // The MCP server is how an agent acts (pitch/vote/claim). Non-custodial:
  // keys live in the agent's local encrypted wallet, never on the server.
  mcp: {
    package: '@pnlmarket/mcp-server',
    install: 'npx -y @pnlmarket/mcp-server install --write',
    docs: 'https://docs.pnl.market/docs/build/mcp-server',
    toolCount: 19,
    tools: MCP_TOOLS,
    actionModes: {
      deepLink: 'pnl_pitch_idea / pnl_vote / pnl_claim return a URL the user signs in their browser wallet — for larger stakes.',
      autosign: 'pnl_pitch_now / pnl_vote_now / pnl_claim_now sign locally from the unlocked wallet — bounded by a per-tx + daily autosign cap.',
    },
  },

  // How requests authenticate. Pure agents use the local wallet + signature path
  // (no Privy / browser required).
  auth: {
    methods: [
      { id: 'mcp-signature', description: 'ed25519 challenge signed by the local wallet. Nonce-bound + payload-bound. Powers the /api/mcp/* write endpoints and pnl_set_username. No browser needed.' },
      { id: 'device-token', description: 'Non-expiring token (pnl_dev_ prefix) from the device-authorization flow; links a terminal to a PNL web account.' },
      { id: 'privy-bearer', description: 'Browser session token for humans on the web app.' },
    ],
  },

  // Rate limits are signalled, not silent: a 429 carries Retry-After +
  // X-RateLimit-Limit / -Remaining / -Reset, and errorCode: RATE_LIMITED.
  rateLimits: {
    signalled: true,
    headers: ['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    note: 'Read endpoints are generously capped (public + Redis-cached); write/MCP endpoints are tighter. Back off using the headers.',
  },

  // Stable enum on any error response, alongside a human `error` string.
  errorCodes: ['BAD_REQUEST', 'NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN', 'RATE_LIMITED', 'VALIDATION', 'UPSTREAM', 'INTERNAL'],

  onChain: {
    network: 'solana-mainnet',
    note: 'Program id, instructions, and discriminators are documented in llms.txt and docs.pnl.market/docs/build/on-chain-program.',
  },
};

export async function GET() {
  return NextResponse.json(CAPABILITIES, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
