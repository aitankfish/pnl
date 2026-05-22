import { z } from 'zod';
import { marketUrl } from '../lib/pnl-api.js';
import { Badge, headline, code, kvTable, next, reply } from '../lib/output.js';

// ─── pnl_vote ────────────────────────────────────────────────────
//
// Prepare a YES/NO stake on an existing market and return a deep-link
// URL with ?vote=<side>&amount=<sol> query params. The market detail
// page reads those on mount and pre-fills the vote panel — the user
// confirms + signs in their browser wallet.
//
// Like pnl_pitch_idea, v0.2 is deep-link only. Phase B autosign will
// build + sign the buy_yes / buy_no transaction locally for stakes
// under the autosign cap.

export const voteInputSchema = {
  marketId: z
    .string()
    .min(1)
    .describe(
      "The market id from pnl_browse_markets or pnl_get_market. Either the Mongo document id or the on-chain market address works.",
    ),
  vote: z
    .enum(['yes', 'no'])
    .describe(
      "'yes' to back the idea (you think it deserves to launch). 'no' to fade it (you think it won't / shouldn't). NO voters split the pool if NO wins — they get paid for filtering noise.",
    ),
  amountSol: z
    .number()
    .positive()
    .describe(
      "How much SOL to stake. Minimum 0.01 SOL on most markets. Typical range 0.01-1 SOL for retail-sized votes.",
    ),
} as const;

const VoteInput = z.object(voteInputSchema);

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export async function callVote(rawInput: unknown) {
  const { marketId, vote, amountSol } = VoteInput.parse(rawInput ?? {});

  // We trust the market id format and let the live page validate
  // existence — no point hitting /api/markets/<id> here just to fail
  // before the user opens the link.
  const base = getApiBase();
  const url = `${base}/market/${encodeURIComponent(marketId)}?vote=${vote}&amount=${amountSol}`;

  const side = vote === 'yes' ? 'YES' : 'NO';
  const sideHint =
    vote === 'yes'
      ? "(backing the idea — you think it deserves to launch)"
      : "(fading the idea — you'll split the pool with other critics if NO wins)";

  return reply(
    headline(`${Badge.draft} ${side} ${amountSol} SOL on \`${marketId}\``),
    `Open this URL to confirm and sign in your browser wallet:`,
    code(url),
    kvTable([
      ['Side', `${side} ${sideHint}`],
      ['Amount', `${amountSol} SOL`],
      ['Market', `\`${marketId}\``],
    ]),
    `The market detail page pre-fills the vote panel from the URL. You'll confirm the side + amount and sign the \`buy_yes\` (or \`buy_no\`) transaction with your wallet (Privy session, or external Phantom if you imported the keypair via \`pnl_export_keypair\`). Transaction confirms in ~5-15s on Solana mainnet.`,
    next('Open the URL in a browser to sign.'),
  );
}
