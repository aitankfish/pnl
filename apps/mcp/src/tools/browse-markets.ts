import { z } from 'zod';
import { browseMarkets, marketUrl, type MarketSummary } from '../lib/pnl-api.js';

// ─── pnl_browse_markets ──────────────────────────────────────────
//
// Read-only tool. Lists live (or historical) conviction markets on PNL.
// Agents call this to answer "what's on PNL right now?" or to find a
// market to vote on. Returns a compact summary so the agent can decide
// whether to drill into one with pnl_get_market.

export const browseMarketsInputSchema = {
  status: z
    .enum(['active', 'yesWins', 'noWins', 'expired', 'refund', 'all'])
    .optional()
    .describe(
      "Which markets to include. 'active' = currently open for voting (default). 'yesWins'/'noWins' = resolved markets. 'expired' = past their deadline but not yet resolved. 'refund' = full-refund outcomes. 'all' = no filter.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('How many markets to return. Default 10. Max 50.'),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('1-indexed page number for pagination. Default 1.'),
} as const;

const BrowseMarketsInput = z.object(browseMarketsInputSchema);
export type BrowseMarketsInput = z.infer<typeof BrowseMarketsInput>;

function formatPool(lamports: number | null | undefined): string {
  if (lamports == null) return '—';
  const sol = lamports / 1e9;
  if (sol < 0.001) return '< 0.001 SOL';
  return `${sol.toFixed(sol < 1 ? 3 : 2)} SOL`;
}

// The list endpoint reports pool size as either:
//   - totalYesStake + totalNoStake (numbers, often null pre-vote), OR
//   - poolBalance (string or number, in lamports)
// Single-market also exposes yesPool + noPool directly. Sum whatever is
// present so we always show *something* if the market has any stake.
function totalPoolLamports(m: MarketSummary): number | null {
  const yesStake = (m.totalYesStake ?? m.yesPool) ?? null;
  const noStake = (m.totalNoStake ?? m.noPool) ?? null;
  if (yesStake != null || noStake != null) {
    return (yesStake ?? 0) + (noStake ?? 0);
  }
  if (m.poolBalance != null) {
    const n = typeof m.poolBalance === 'string' ? Number(m.poolBalance) : m.poolBalance;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatMarket(m: MarketSummary): string {
  const founder = m.founderDisplayName || m.founderUsername;
  const yesPct = m.yesPercentage != null ? `${Math.round(m.yesPercentage)}% YES` : '—';
  const pool = formatPool(totalPoolLamports(m));
  const votes = m.totalParticipants ?? 0;
  const status = m.displayStatus || m.status || 'unknown';
  const symbol = m.tokenSymbol ? `$${m.tokenSymbol}` : null;
  return [
    `• ${m.name}${symbol ? ` (${symbol})` : ''}${founder ? ` — by ${founder}` : ''}`,
    `  status: ${status} · ${yesPct} · pool: ${pool} · ${votes} ${votes === 1 ? 'vote' : 'votes'}${m.timeLeft ? ` · ${m.timeLeft} left` : ''}`,
    `  url: ${marketUrl(m.id)}`,
    m.description ? `  "${m.description.replace(/\s+/g, ' ').trim().slice(0, 140)}${m.description.length > 140 ? '…' : ''}"` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function callBrowseMarkets(rawInput: unknown) {
  const input = BrowseMarketsInput.parse(rawInput ?? {});
  const status = input.status ?? 'active';
  const limit = input.limit ?? 10;
  const page = input.page ?? 1;

  const data = await browseMarkets({ status, limit, page });
  const markets = data.markets ?? [];

  if (markets.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `No markets matched status="${status}" on page ${page}.`,
        },
      ],
    };
  }

  const header = `${markets.length} market${markets.length === 1 ? '' : 's'} (status=${status}, page=${page}${data.total ? `, ${data.total} total` : ''}):`;
  const body = markets.map(formatMarket).join('\n\n');
  const more = data.hasMore
    ? `\n\nMore markets available — call again with page=${page + 1}.`
    : '';

  return {
    content: [
      {
        type: 'text' as const,
        text: `${header}\n\n${body}${more}\n\n— Raw JSON —\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}
