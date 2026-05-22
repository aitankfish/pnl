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
import { initInputSchema, callInit } from './tools/init.js';
import { walletInputSchema, callWallet } from './tools/wallet.js';
import { exportKeypairInputSchema, callExportKeypair } from './tools/export-keypair.js';
import { pitchIdeaInputSchema, callPitchIdea } from './tools/pitch-idea.js';
import { setUsernameInputSchema, callSetUsername } from './tools/set-username.js';
import { unlockInputSchema, callUnlock, lockInputSchema, callLock } from './tools/unlock.js';
import { restoreInputSchema, callRestore } from './tools/restore.js';
import { helpInputSchema, callHelp } from './tools/help.js';
import { voteInputSchema, callVote } from './tools/vote.js';
import { runInstall } from './install.js';

const SERVER_NAME = 'pnl-mcp-server';
const SERVER_VERSION = '0.1.0';

// CLI dispatch — when invoked as `pnl-mcp-server install`, run the
// installer that wires this server into the user's agent configs and
// drops the slash-command skills into ~/.claude/skills/. Otherwise
// (the case the agent runtime hits) start the stdio MCP server.
async function maybeRunCli(): Promise<boolean> {
  const subcommand = process.argv[2];
  if (subcommand === 'install') {
    const code = await runInstall(process.argv.slice(2));
    process.exit(code);
  }
  return false;
}

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
    'pnl_help',
    "Show the PNL command reference with every available tool, what it does, and a typical first-run flow. Context-aware — adjusts the suggested next step based on whether the user has a wallet and whether it's unlocked. Use this when the user types '/pnl-help', says 'how do I use PNL', or asks what's possible.",
    helpInputSchema,
    async (args) => callHelp(args),
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

  server.tool(
    'pnl_init',
    'First-run setup. Generates a local Solana keypair on this machine (stored at ~/.config/pnl/keypair.json, mode 0600) and returns the deposit address. Call this when the user wants to set up PNL on a new machine or asks "how do I get started with PNL?". Idempotent — if a keypair already exists, returns the existing wallet info.',
    initInputSchema,
    async (args) => callInit(args),
  );

  server.tool(
    'pnl_wallet',
    "Show the local PNL wallet's address and current SOL balance. Read-only. Call this any time the user asks 'what's my PNL wallet?', 'how much SOL do I have?', or to check whether their funding transaction has landed.",
    walletInputSchema,
    async (args) => callWallet(args),
  );

  server.tool(
    'pnl_export_keypair',
    "Reveal the local PNL secret key in base58 (Phantom-import format) and JSON-array (Solana CLI format). Requires confirm: 'EXPORT' to prevent accidental disclosure. Use only when the user explicitly asks to back up their key, move their wallet to Phantom/Solflare/etc., or migrate to another machine.",
    exportKeypairInputSchema,
    async (args) => callExportKeypair(args),
  );

  server.tool(
    'pnl_pitch_idea',
    "Pitch a new idea to PNL as a conviction market. The agent supplies the name, description, ticker symbol, category/type/stage, team size, target pool in SOL, duration in days, and optional provenance (the conversation excerpt + code snippet that birthed the idea). Returns a /create?draft=<id> deep-link the user opens in their browser to confirm + sign the create_market transaction in their own wallet. v0.2 is deep-link only -- v0.3 will add local autosigning for under-cap transactions. Use this when the user says 'pitch this on PNL', 'plant this idea', or similar.",
    pitchIdeaInputSchema,
    async (args) => callPitchIdea(args),
  );

  server.tool(
    'pnl_unlock',
    "Unlock the local PNL wallet for signing. Pulls the passphrase from the PNL_PASSPHRASE env var (set in Claude Code mcp config) or pops an OS-native dialog (osascript on macOS, zenity on Linux). The passphrase NEVER comes from tool arguments and never enters the chat transcript. Caches the unlocked secret in memory for ttl_minutes (default 5, max 60). Re-call to refresh the TTL. Call this before any signing tool: pnl_set_username, pnl_export_keypair, future write-prep tools.",
    unlockInputSchema,
    async (args) => callUnlock(args),
  );

  server.tool(
    'pnl_lock',
    'Lock the local PNL wallet immediately. Wipes the cached secret from memory, future signing operations require a fresh pnl_unlock. Use this when stepping away from the machine or after a sensitive session.',
    lockInputSchema,
    async (args) => callLock(args),
  );

  server.tool(
    'pnl_restore',
    "Restore a PNL wallet on this machine from a BIP39 mnemonic (12 or 24 words). Use when setting up PNL on a new machine and the user already has the recovery phrase from a previous pnl_init. The mnemonic is the standard format Phantom / Solflare / Backpack / Solana CLI all accept. Refuses to overwrite an existing wallet unless allowOverwrite: true is passed. Passphrase is read from PNL_PASSPHRASE env or via OS dialog.",
    restoreInputSchema,
    async (args) => callRestore(args),
  );

  server.tool(
    'pnl_vote',
    "Stake YES or NO on an existing PNL market. Returns a deep-link URL with the side + amount pre-filled — the user opens it in their browser, confirms the vote panel (already populated), and signs the buy_yes / buy_no transaction with their wallet. Use this when the user says 'vote yes on X', 'fade Y', 'back the AutoImport CLI market', or similar. Phase B will add a local-signing variant for stakes under the autosign cap.",
    voteInputSchema,
    async (args) => callVote(args),
  );

  server.tool(
    'pnl_set_username',
    "Claim or rename the PNL username for the local wallet. Signs a time-bounded challenge with the keypair from pnl_init so the backend can verify wallet ownership -- no Privy session or Gmail login required. Usernames are 3-20 characters of letters/numbers/_/-. Returns 'taken' if another wallet has claimed the name. Use when the user says 'set my PNL username to X', 'rename my PNL profile', or after pnl_init when they want a custom name instead of the auto-generated Cosmic one.",
    setUsernameInputSchema,
    async (args) => callSetUsername(args),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Stdio transport keeps the process alive while the host (Claude Code /
  // Cursor / etc.) holds the pipe. No need to log anything to stdout —
  // stdout is the MCP message channel. stderr is fine for diagnostics.
  process.stderr.write(`[${SERVER_NAME}@${SERVER_VERSION}] ready · ${process.env.PNL_API_BASE_URL || 'https://pnl.market'}\n`);
}

(async () => {
  await maybeRunCli();
  await main();
})().catch((err) => {
  process.stderr.write(`[${SERVER_NAME}] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
