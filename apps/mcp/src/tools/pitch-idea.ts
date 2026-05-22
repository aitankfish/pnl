import { z } from 'zod';
import { Badge, headline, code, kvTable, next, reply } from '../lib/output.js';

// ─── pnl_pitch_idea ──────────────────────────────────────────────
//
// Write-prep tool. The agent calls this with everything it knows
// about a new idea. We POST it to the public /api/markets/drafts
// endpoint, receive a draft id, and return a deep-link the user
// opens in their browser to confirm + sign with their own wallet.
//
// MCP NEVER holds keys. v0.2 is deep-link only; v0.3 will add an
// autosign path that signs locally with the keypair set up by
// pnl_init for amounts under the autosign cap.
//
// Optional `provenance` argument carries the conversation excerpt
// and/or code snippet that birthed the idea -- pinned to IPFS by
// the /create page alongside the market metadata, then displayed
// on the market detail page as "this idea was born from a
// conversation in <agent> on <date>".

const CATEGORIES = [
  'DeFi', 'NFT', 'Gaming', 'DAO', 'AI/ML', 'Infrastructure', 'Social', 'Meme',
  'Creator', 'Healthcare', 'Science', 'Education', 'Finance', 'Commerce',
  'Real Estate', 'Energy', 'Media', 'Manufacturing', 'Mobility', 'Other',
] as const;

const PROJECT_TYPES = ['Protocol', 'Application', 'Platform', 'Service', 'Tool'] as const;
const PROJECT_STAGES = ['Idea', 'MVP', 'Beta', 'Production', 'Scaling', 'Prototype', 'Launched'] as const;

export const pitchIdeaInputSchema = {
  name: z
    .string()
    .min(1)
    .max(255)
    .describe("Project name (the headline). E.g. 'AutoImport CLI'. 1-255 chars."),
  description: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "What the idea actually is — what gets built and why. 1-2000 chars. Treat this like a short pitch the conviction market will trade on; concrete is better than abstract.",
    ),
  tokenSymbol: z
    .string()
    .min(3)
    .max(10)
    .regex(/^[A-Z0-9]+$/i, 'token symbol must be alphanumeric')
    .describe(
      "Ticker symbol the token will use if YES wins (3-10 uppercase alphanumeric). E.g. 'AUTOIMP' for AutoImport CLI.",
    ),
  category: z
    .enum(CATEGORIES)
    .describe('One of the supported project categories.'),
  projectType: z
    .enum(PROJECT_TYPES)
    .describe("Protocol | Application | Platform | Service | Tool. Default 'Tool' if uncertain."),
  projectStage: z
    .enum(PROJECT_STAGES)
    .describe(
      "Where the idea is today. 'Idea' for never-built, 'MVP' for proof-of-concept, etc. Be honest -- this informs how the market reads the pitch.",
    ),
  teamSize: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe('How many people are working on this. Use 1 if the user is solo.'),
  targetPoolSol: z
    .number()
    .positive()
    .describe(
      'Target pool size in SOL. Once the YES pool reaches this number, the market can resolve early. Typical range 5-50 SOL.',
    ),
  durationDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .describe(
      'How long the market stays open for voting before resolution. Typical range 7-90 days. Default 30 if uncertain.',
    ),
  projectImageUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional URL to a project image / logo. If omitted, the market detail page renders a colored circle with the ticker initial.",
    ),
  pitchVideoUrl: z
    .string()
    .url()
    .optional()
    .describe('Optional URL to a pitch video (YouTube, Vimeo, IPFS, etc).'),
  twitterHandle: z
    .string()
    .optional()
    .describe("Optional X/Twitter handle (without '@'). Surfaced on the market page and auto-tweet."),
  location: z
    .string()
    .max(255)
    .optional()
    .describe("Optional location string (city / country). Defaults to founder's profile if omitted."),
  provenance: z
    .object({
      source: z
        .enum(['claude-code', 'cursor', 'cline', 'codex', 'other'])
        .describe('Which agent the idea was born in.'),
      excerpt: z
        .string()
        .max(2000)
        .describe(
          'The conversation excerpt that surfaced the idea. The 1-3 sentences immediately before the user said "let\'s pitch this on PNL".',
        ),
      codeSnippet: z
        .string()
        .max(2000)
        .optional()
        .describe(
          'Optional code snippet that motivated the idea (e.g. a // TODO comment, a function that wanted to become its own tool).',
        ),
      timestamp: z
        .string()
        .optional()
        .describe('ISO 8601 timestamp of the originating conversation.'),
    })
    .optional()
    .describe(
      'Optional "tribute to the idea" payload — pinned alongside the market metadata and displayed on the market detail page. Only attach when the user agrees to make the context public.',
    ),
} as const;

const PitchIdeaInput = z.object(pitchIdeaInputSchema);

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export async function callPitchIdea(rawInput: unknown) {
  const input = PitchIdeaInput.parse(rawInput ?? {});

  // The /create page expects the same field shape as the Project schema,
  // so we mirror its naming. socialLinks is a Map but the form accepts
  // a simple object of {platform: url} pairs.
  const payload: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    category: input.category,
    projectType: input.projectType,
    projectStage: input.projectStage,
    tokenSymbol: input.tokenSymbol.toUpperCase(),
    teamSize: input.teamSize,
    targetPoolSol: input.targetPoolSol,
    durationDays: input.durationDays,
  };
  if (input.projectImageUrl) payload.projectImageUrl = input.projectImageUrl;
  if (input.pitchVideoUrl) payload.pitchVideoUrl = input.pitchVideoUrl;
  if (input.twitterHandle) payload.socialLinks = { twitter: input.twitterHandle.replace(/^@/, '') };
  if (input.location) payload.location = input.location;

  const body = {
    payload,
    provenance: input.provenance,
    source: 'mcp',
  };

  const res = await fetch(`${getApiBase()}/api/markets/drafts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'pnl-mcp-server/0.2.0 (+https://docs.pnl.market)',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`PNL drafts API ${res.status} ${res.statusText}${errBody ? ` — ${errBody.slice(0, 300)}` : ''}`);
  }

  const data = (await res.json()) as {
    success: boolean;
    draftId?: string;
    deepLink?: string;
    expiresAt?: string;
    error?: string;
  };
  if (!data.success || !data.deepLink) {
    throw new Error(`PNL drafts API returned no deepLink — ${data.error || 'unknown error'}`);
  }

  return reply(
    headline(`${Badge.draft} Drafted · $${input.tokenSymbol.toUpperCase()} — ${input.name}`),
    `Open this URL to confirm and post the market on Solana mainnet:`,
    code(data.deepLink),
    kvTable([
      ['Idea', input.name],
      ['Ticker', `$${input.tokenSymbol.toUpperCase()}`],
      ['Target pool', `${input.targetPoolSol} SOL`],
      ['Duration', `${input.durationDays} days`],
      ['Stage', `${input.projectStage} · ${input.category}`],
      input.provenance
        ? ['Provenance', `${input.provenance.source}${input.provenance.timestamp ? ' · ' + input.provenance.timestamp : ''}`]
        : (null as any),
      ['Draft id', `\`${data.draftId}\``],
      ['Expires', data.expiresAt ?? '—'],
    ].filter((r): r is [string, string] => Array.isArray(r))),
    `The /create page is pre-filled with everything above. The user signs the on-chain \`create_market\` transaction in their browser wallet (or imports the keypair from \`pnl_export_keypair\` into Phantom first). Market goes live as soon as the tx confirms (~5-15s on Solana mainnet).`,
    input.provenance
      ? `_Provenance attached — will be displayed on the market detail page after launch._`
      : null,
    next('Open the URL in a browser and confirm.'),
  );
}
