import { z } from 'zod';
import { getMarket } from '../lib/pnl-api.js';
import { Badge, headline, code, kvTable, next, reply } from '../lib/output.js';

// ─── pnl_claim ──────────────────────────────────────────────────
//
// Deep-link mode. Returns the /market/<id>?claim=1 URL — the market
// detail page detects the query param, opens the claim panel, and
// the user signs in their browser wallet.
//
// For autosign (no browser), use pnl_claim_now.

export const claimInputSchema = {
  marketId: z
    .string()
    .min(1)
    .describe(
      "Market id from pnl_browse_markets or your wallet's history. Accepts the Mongo id or the on-chain market address. The market must be resolved (YES wins, NO wins, or refund) and the wallet must have an unclaimed position.",
    ),
} as const;

const ClaimInput = z.object(claimInputSchema);

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export async function callClaim(rawInput: unknown) {
  const { marketId } = ClaimInput.parse(rawInput ?? {});
  const base = getApiBase();

  // Quick sanity fetch — surface the resolution + token mint info in
  // the reply so the user knows what they're about to claim.
  let market;
  try {
    market = await getMarket(marketId);
  } catch (e) {
    return reply(
      headline(`${Badge.err} Couldn't load market \`${marketId}\``),
      `Check the id with \`pnl_browse_markets\`. Error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const url = `${base}/market/${encodeURIComponent(marketId)}?claim=1`;
  const resLabel = market.resolution || market.status || 'unknown';

  return reply(
    headline(`${Badge.draft} Claim ready — ${market.name ?? marketId}`),
    `Open this URL to confirm and sign in your browser wallet:`,
    code(url),
    kvTable([
      ['Market', market.name ?? marketId],
      ['Resolution', resLabel],
      ['Phase', market.phase ?? '—'],
    ]),
    `The market detail page detects \`?claim=1\` and opens the claim panel. Sign the \`claim_rewards\` tx in your wallet — confirms in ~5-15s.`,
    next('Open the URL in a browser to sign.'),
  );
}
