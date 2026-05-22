import { z } from 'zod';
import { browseMarkets, marketUrl, type MarketSummary } from '../lib/pnl-api.js';
import { Badge, headline, table, next, reply } from '../lib/output.js';

// ─── pnl_browse_markets ──────────────────────────────────────────

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

function fmtPool(m: MarketSummary): string {
  const yes = m.totalYesStake ?? m.yesPool ?? null;
  const no = m.totalNoStake ?? m.noPool ?? null;
  let total: number | null = null;
  if (yes != null || no != null) {
    total = (yes ?? 0) + (no ?? 0);
  } else if (m.poolBalance != null) {
    const n = typeof m.poolBalance === 'string' ? Number(m.poolBalance) : m.poolBalance;
    if (Number.isFinite(n)) total = n;
  }
  if (total == null) return '—';
  const sol = total / 1e9;
  if (sol < 0.001) return '< 0.001';
  if (sol < 1) return sol.toFixed(3);
  return sol.toFixed(2);
}

function fmtYes(m: MarketSummary): string {
  return m.yesPercentage != null ? `${Math.round(m.yesPercentage)}%` : '—';
}

function fmtStatus(m: MarketSummary): string {
  const s = (m.displayStatus || m.status || '').toLowerCase();
  if (s.includes('active')) return Badge.live;
  if (s.includes('yes')) return 'YES';
  if (s.includes('no')) return 'NO';
  if (s.includes('refund')) return 'refund';
  if (s.includes('expired') || s.includes('awaiting')) return Badge.pending;
  return s || '—';
}

export async function callBrowseMarkets(rawInput: unknown) {
  const input = BrowseMarketsInput.parse(rawInput ?? {});
  const status = input.status ?? 'active';
  const limit = input.limit ?? 10;
  const page = input.page ?? 1;

  const data = await browseMarkets({ status, limit, page });
  const markets = data.markets ?? [];

  if (markets.length === 0) {
    return reply(
      headline(`No ${status === 'all' ? '' : status + ' '}markets on page ${page}.`),
      next(status !== 'all' ? 'Try `status: "all"` to include resolved + expired.' : 'No markets on PNL yet — be the first to plant one with `/pnl-pitch`.'),
    );
  }

  const tableRows = markets.map((m) => {
    const symbol = m.tokenSymbol ? `$${m.tokenSymbol}` : '—';
    const founder = m.founderDisplayName || m.founderUsername || '—';
    return [
      `**${m.name}**${m.name.length > 28 ? '' : ''}`,
      symbol,
      fmtStatus(m),
      fmtYes(m),
      fmtPool(m) + ' SOL',
      String(m.totalParticipants ?? 0),
      founder,
    ];
  });

  const urls = markets
    .map((m) => `- \`${m.name}\` → ${marketUrl(m.id)}`)
    .join('\n');

  const headerLine = `${markets.length} ${status === 'all' ? '' : status + ' '}market${markets.length === 1 ? '' : 's'}${data.total ? ` of ${data.total}` : ''} · page ${page}`;

  return reply(
    headline(headerLine),
    table(['Market', 'Ticker', 'Status', 'YES', 'Pool', 'Votes', 'Founder'], tableRows),
    urls,
    data.hasMore ? `_More available — call again with \`page: ${page + 1}\`._` : null,
    next('`/pnl-get <id>` (or ask) for full detail, `/pnl-pitch` to post your own.'),
  );
}
