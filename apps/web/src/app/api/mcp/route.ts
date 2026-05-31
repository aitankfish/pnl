// POST /api/mcp  — Hosted (remote) Model Context Protocol endpoint
//
// This is the "bring your own AI" surface. Any MCP-capable client that
// supports remote servers (Claude Desktop/Code, ChatGPT, Cursor, etc.)
// can add `https://pnl.market/api/mcp` as a server URL with ZERO install
// — no npx, no local package. It speaks MCP over Streamable HTTP using
// the SDK's Fetch-native transport, which maps cleanly onto an App
// Router route handler.
//
// SECURITY POSTURE — this server NEVER holds keys.
//   - Read tools (browse / get / help) need no auth.
//   - Write tools (pitch / vote / claim) are DEEP-LINK ONLY: they return
//     a pnl.market URL the user opens to confirm + sign in their own
//     browser wallet. The hosted server cannot sign, cannot custody SOL,
//     and cannot move funds. Autosign + local encrypted wallets remain
//     exclusive to the local npx server (`@pnlmarket/mcp-server`), where
//     the key lives on the user's own machine.
//
// Statelessness: each request spins up a fresh McpServer + transport
// (sessionIdGenerator: undefined, enableJsonResponse: true). No session
// state survives between requests, which is the correct shape for a
// horizontally-scaled serverless deploy.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const logger = createClientLogger();

const SERVER_NAME = 'pnl-remote';
const SERVER_VERSION = '0.1.0';

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = raw && raw.length > 0 ? raw : 'https://pnl.market';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

// ─── Public API client (fetch-only, same shaping the npx server sees) ──
// The public read endpoints wrap responses as { success, data }. We hit
// our own origin so the agent gets the exact display-ready payload the
// browse UI uses (gateway URLs, display status, etc.), TTL-cached at the
// source. No DB coupling here — this stays a thin HTTP client.

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${siteUrl()}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': `${SERVER_NAME}/${SERVER_VERSION} (+https://docs.pnl.market)`,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`PNL API ${res.status} ${res.statusText} on ${path}`);
  }
  const json = (await res.json()) as Envelope<T> | T;
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    const env = json as Envelope<T>;
    if (!env.success) throw new Error(env.error || 'PNL API returned success: false');
    return env.data;
  }
  return json as T;
}

interface MarketSummary {
  id: string;
  name?: string;
  category?: string;
  yesPercentage?: number | null;
  totalYesStake?: number | null;
  totalNoStake?: number | null;
  yesPool?: number | null;
  noPool?: number | null;
  poolBalance?: string | number | null;
  displayStatus?: string;
  status?: string;
  phase?: string;
  resolution?: string;
  timeLeft?: string;
  expiryTime?: string;
  founderUsername?: string;
  founderDisplayName?: string;
  marketAddress?: string;
  description?: string;
}

// Units (confirmed against the live API): totalYesStake/totalNoStake are SOL
// and only present on resolved markets; poolBalance is lamports (string) and
// present on every market. Sum the stakes as-is; divide poolBalance by 1e9.
function poolSol(m: MarketSummary): string {
  const yes = m.totalYesStake ?? m.yesPool ?? null;
  const no = m.totalNoStake ?? m.noPool ?? null;
  let sol: number | null = null;
  if (yes != null || no != null) {
    sol = (yes ?? 0) + (no ?? 0); // already SOL
  } else if (m.poolBalance != null) {
    const n = typeof m.poolBalance === 'string' ? Number(m.poolBalance) : m.poolBalance;
    if (Number.isFinite(n)) sol = n / 1e9; // lamports -> SOL
  }
  if (sol == null) return '—';
  if (sol < 0.001) return '< 0.001 SOL';
  return `${sol < 1 ? sol.toFixed(3) : sol.toFixed(2)} SOL`;
}

function yesPct(m: MarketSummary): string {
  return m.yesPercentage != null ? `${Math.round(m.yesPercentage)}% YES` : '—';
}

function text(body: string) {
  return { content: [{ type: 'text' as const, text: body }] };
}

type ToolResult = { content: { type: 'text'; text: string }[] };

// Bridge for the zod-version split. apps/web ships zod v4; the MCP SDK's
// static types are pinned to its own zod build, so passing a v4 raw shape
// fails TS overload resolution even though the SDK's runtime zod-compat
// layer handles v4 fine (it detects the `_zod` brand and converts to JSON
// Schema). We cast only at the call boundary and keep full inference on the
// callback args via `z.infer`.
function addTool<S extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  shape: S,
  cb: (args: z.infer<z.ZodObject<S>>) => ToolResult | Promise<ToolResult>,
): void {
  (server.tool as (...a: unknown[]) => unknown)(
    name,
    description,
    shape,
    (args: unknown) => cb(args as z.infer<z.ZodObject<S>>),
  );
}

// ─── Server construction ───────────────────────────────────────────────
// Rebuilt per request (stateless). Tools mirror the local server's read +
// deep-link surface; the wallet / autosign tools are intentionally absent.

function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  addTool(server,
    'pnl_help',
    'Show what this hosted PNL endpoint can do and the typical flow. Use when the user asks how to use PNL or what is possible here.',
    {},
    async () =>
      text(
        [
          '# PNL — hosted MCP endpoint',
          '',
          'PNL is a coordination market for ideas on Solana: anyone plants an idea as a',
          'conviction market; believers stake YES, critics stake NO with real SOL. YES wins',
          '→ the idea launches as a token on pump.fun. NO wins → critics split the pool.',
          '',
          '## Tools here (read + deep-link, no key custody)',
          '- `pnl_browse_markets` — list live / resolved markets',
          '- `pnl_get_market` — full state of one market by id or on-chain address',
          '- `pnl_pitch_idea` — draft a new market, returns a /create deep-link to sign',
          '- `pnl_vote` — returns a /market deep-link with side + amount pre-filled',
          '- `pnl_claim` — returns a /market deep-link to claim rewards on a resolved market',
          '',
          '## How writes work',
          'This hosted server never holds keys. Pitch / vote / claim return a pnl.market URL.',
          'You open it in a browser and sign the on-chain transaction in your own wallet.',
          '',
          '## Want autosign + a local wallet?',
          'Install the local server: `npx -y @pnlmarket/mcp-server`. It keeps an encrypted',
          'keypair on your machine and can sign under-cap transactions without a browser bounce.',
        ].join('\n'),
      ),
  );

  addTool(server,
    'pnl_browse_markets',
    "List conviction markets on PNL. Use when the user asks what's live right now or wants to see idea markets. Filter by status; paginate with page + limit.",
    {
      status: z
        .enum(['active', 'yesWins', 'noWins', 'expired', 'refund', 'all'])
        .optional()
        .describe("Which markets. 'active' = open for voting (default)."),
      limit: z.number().int().min(1).max(50).optional().describe('How many to return. Default 10, max 50.'),
      page: z.number().int().min(1).optional().describe('1-indexed page. Default 1.'),
    },
    async ({ status, limit, page }) => {
      const qs = new URLSearchParams({
        status: status ?? 'active',
        limit: String(limit ?? 10),
        page: String(page ?? 1),
      });
      const data = await apiGet<{ markets: MarketSummary[]; total?: number; hasMore?: boolean }>(
        `/api/markets/list?${qs.toString()}`,
      );
      const markets = data.markets ?? [];
      if (markets.length === 0) {
        return text(`No markets found for status "${status ?? 'active'}".`);
      }
      const lines = markets.map((m) => {
        const url = `${siteUrl()}/market/${encodeURIComponent(m.id)}`;
        const founder = m.founderDisplayName || (m.founderUsername ? `@${m.founderUsername}` : 'anon');
        return [
          `• ${m.name ?? m.id}  —  ${yesPct(m)} · pool ${poolSol(m)} · ${m.displayStatus || m.status || '—'}`,
          `  by ${founder}${m.timeLeft ? ` · ${m.timeLeft} left` : ''} · id: ${m.id}`,
          `  ${url}`,
        ].join('\n');
      });
      const head = `${markets.length} market${markets.length === 1 ? '' : 's'} (status: ${status ?? 'active'})${data.hasMore ? ' · more on next page' : ''}`;
      return text(`${head}\n\n${lines.join('\n\n')}`);
    },
  );

  addTool(server,
    'pnl_get_market',
    'Fetch one market by id (from pnl_browse_markets) or by on-chain market address. Returns full state — name, founder, description, YES%, pools, expiry, resolution, addresses.',
    {
      marketId: z.string().min(1).describe('Market id or on-chain market address.'),
    },
    async ({ marketId }) => {
      const m = await apiGet<MarketSummary>(`/api/markets/${encodeURIComponent(marketId)}`);
      const url = `${siteUrl()}/market/${encodeURIComponent(m.id ?? marketId)}`;
      const founder = m.founderDisplayName || (m.founderUsername ? `@${m.founderUsername}` : 'anon');
      const lines = [
        `# ${m.name ?? marketId}`,
        m.description ? `\n${m.description.slice(0, 600)}\n` : '',
        `Status:     ${m.displayStatus || m.status || '—'}${m.resolution ? ` (${m.resolution})` : ''}`,
        `Phase:      ${m.phase ?? '—'}`,
        `Conviction: ${yesPct(m)}`,
        `Pool:       ${poolSol(m)}`,
        `Founder:    ${founder}`,
        m.timeLeft ? `Time left:  ${m.timeLeft}` : '',
        m.expiryTime ? `Expires:    ${m.expiryTime}` : '',
        m.marketAddress ? `On-chain:   ${m.marketAddress}` : '',
        `\n${url}`,
      ].filter(Boolean);
      return text(lines.join('\n'));
    },
  );

  addTool(server,
    'pnl_pitch_idea',
    'Pitch a new idea to PNL as a conviction market. Returns a /create deep-link the user opens to confirm and sign the create_market transaction in their own browser wallet. This hosted server never signs.',
    {
      name: z.string().min(1).describe('The idea / project name.'),
      description: z.string().min(1).describe('What the idea is and why it should exist.'),
      category: z.string().min(1).describe('e.g. "AI Platforms / Agents", "DeFi", "Consumer Apps".'),
      tokenSymbol: z.string().min(1).max(10).describe('Proposed ticker, e.g. "IDEA".'),
      projectType: z.string().optional().describe('e.g. "Application", "Protocol", "Tooling". Default "Application".'),
      projectStage: z.string().optional().describe('e.g. "Idea", "Prototype", "Live". Default "Idea".'),
      teamSize: z.number().int().min(1).optional().describe('Number of people. Default 1.'),
      targetPoolSol: z.number().positive().optional().describe('Target raise in SOL. Default 10.'),
      durationDays: z.number().int().min(1).max(30).optional().describe('Voting window in days. Default 7.'),
      twitterHandle: z.string().optional().describe('Optional X/Twitter handle.'),
    },
    async (args) => {
      const payload: Record<string, unknown> = {
        name: args.name,
        description: args.description,
        category: args.category,
        projectType: args.projectType ?? 'Application',
        projectStage: args.projectStage ?? 'Idea',
        tokenSymbol: args.tokenSymbol.toUpperCase(),
        teamSize: args.teamSize ?? 1,
        targetPoolSol: args.targetPoolSol ?? 10,
        durationDays: args.durationDays ?? 7,
      };
      if (args.twitterHandle) payload.socialLinks = { twitter: args.twitterHandle.replace(/^@/, '') };

      const res = await fetch(`${siteUrl()}/api/markets/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': `${SERVER_NAME}/${SERVER_VERSION} (+https://docs.pnl.market)`,
        },
        body: JSON.stringify({ payload, source: 'mcp-remote' }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        deepLink?: string;
        draftId?: string;
        error?: string;
      };
      if (!res.ok || !data.success || !data.deepLink) {
        throw new Error(`Could not draft market: ${data.error || `${res.status} ${res.statusText}`}`);
      }
      return text(
        [
          `Drafted: $${payload.tokenSymbol} — ${args.name}`,
          `Target pool: ${payload.targetPoolSol} SOL · Duration: ${payload.durationDays} days`,
          '',
          'Open this URL to confirm and sign the create_market transaction in your wallet:',
          data.deepLink,
          '',
          `Draft id: ${data.draftId}. The /create page is pre-filled — you sign on Solana mainnet (~5-15s).`,
        ].join('\n'),
      );
    },
  );

  addTool(server,
    'pnl_vote',
    'Stake YES or NO on a market. Returns a deep-link with side + amount pre-filled; the user opens it and signs buy_yes / buy_no in their own wallet. This hosted server never signs.',
    {
      marketId: z.string().min(1).describe('Market id or on-chain address.'),
      vote: z.enum(['yes', 'no']).describe("'yes' backs the idea, 'no' fades it."),
      amountSol: z.number().positive().describe('SOL to stake. Minimum 0.01 on most markets.'),
    },
    async ({ marketId, vote, amountSol }) => {
      const url = `${siteUrl()}/market/${encodeURIComponent(marketId)}?vote=${vote}&amount=${amountSol}`;
      const side = vote === 'yes' ? 'YES' : 'NO';
      return text(
        [
          `${side} ${amountSol} SOL on ${marketId}`,
          '',
          'Open this URL to confirm and sign in your browser wallet:',
          url,
          '',
          'The market page pre-fills the vote panel from the URL. You sign the buy_yes / buy_no transaction yourself (~5-15s on mainnet).',
        ].join('\n'),
      );
    },
  );

  addTool(server,
    'pnl_claim',
    'Claim rewards on a resolved market (YES wins, NO wins, or refund). Returns a /market?claim=1 deep-link the user opens to sign claim_rewards in their own wallet.',
    {
      marketId: z.string().min(1).describe('Market id or on-chain address. Must be resolved with an unclaimed position.'),
    },
    async ({ marketId }) => {
      let label = marketId;
      let resolution = 'unknown';
      try {
        const m = await apiGet<MarketSummary>(`/api/markets/${encodeURIComponent(marketId)}`);
        label = m.name ?? marketId;
        resolution = m.resolution || m.status || 'unknown';
      } catch {
        // Non-fatal — still hand back the link; the page validates eligibility.
      }
      const url = `${siteUrl()}/market/${encodeURIComponent(marketId)}?claim=1`;
      return text(
        [
          `Claim — ${label} (${resolution})`,
          '',
          'Open this URL to confirm and sign claim_rewards in your browser wallet:',
          url,
        ].join('\n'),
      );
    },
  );

  return server;
}

// ─── Transport plumbing ────────────────────────────────────────────────

async function handleMcp(req: Request): Promise<Response> {
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session id, respond with a single JSON body instead of
    // an SSE stream. Correct for serverless where instances aren't sticky.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  // Generous: one agent session is several POSTs (initialize, tools/list,
  // tools/call...). 120/min/IP throttles abuse without breaking real use.
  const limited = await checkRateLimit(`mcp-remote:${ip}`, 120, 60_000);
  if (limited) return limited;

  try {
    return await handleMcp(req);
  } catch (err) {
    logger.error('[mcp-remote] request failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// GET / DELETE are part of the Streamable HTTP spec (SSE stream + session
// teardown). In stateless JSON mode the transport replies 405 to these,
// which compliant clients handle gracefully.
export async function GET(req: Request): Promise<Response> {
  return handleMcp(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return handleMcp(req);
}
