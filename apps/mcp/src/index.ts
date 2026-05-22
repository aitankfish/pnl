#!/usr/bin/env node
// @pnl/mcp-server — Model Context Protocol server for PNL.
//
// Lets agents (Claude Code, Cursor, Cline, Codex, the next one) browse
// the live conviction-market state on pnl.market and — in later versions
// — prepare new pitches and votes the user signs in their own wallet.
//
// Critical: this server NEVER holds keys. Read tools are pure fetches
// against the public API. Write-prep tools (coming next) return deep-
// links to pnl.market; the user always confirms the signature in their
// own wallet.
//
// Transport: stdio. That's the standard for Claude Code / Cursor / Cline.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { browseMarketsInputSchema, callBrowseMarkets } from './tools/browse-markets.js';
import { getMarketInputSchema, callGetMarket } from './tools/get-market.js';

const SERVER_NAME = 'pnl-mcp-server';
const SERVER_VERSION = '0.1.0';

async function main(): Promise<void> {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      // We only register tools today. Resources / prompts come later
      // alongside the write-prep tools.
      capabilities: { tools: {} },
    },
  );

  server.tool(
    'pnl_browse_markets',
    "List live conviction markets on PNL. Use this when the user asks 'what's on PNL right now?' or wants to see active idea markets. Returns market names, current YES%, total pool, vote counts, and a URL for each. Filter by status (active, yesWins, noWins, expired, refund, all). Paginate with page+limit.",
    browseMarketsInputSchema,
    async (args) => callBrowseMarkets(args),
  );

  server.tool(
    'pnl_get_market',
    'Fetch one market by id (from pnl_browse_markets) or by on-chain market address. Returns the full market state — name, founder, description, YES%, pool sizes, expiry, on-chain address. Use this after pnl_browse_markets when the user wants details on a specific market.',
    getMarketInputSchema,
    async (args) => callGetMarket(args),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Stdio transport keeps the process alive while the host (Claude Code /
  // Cursor / etc.) holds the pipe. No need to log anything to stdout —
  // stdout is the MCP message channel. stderr is fine for diagnostics.
  process.stderr.write(`[${SERVER_NAME}@${SERVER_VERSION}] ready · ${process.env.PNL_API_BASE_URL || 'https://pnl.market'}\n`);
}

main().catch((err) => {
  process.stderr.write(`[${SERVER_NAME}] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
