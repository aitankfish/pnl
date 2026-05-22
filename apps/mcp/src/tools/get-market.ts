import { z } from 'zod';
import { getMarket, marketUrl } from '../lib/pnl-api.js';

// ─── pnl_get_market ──────────────────────────────────────────────
//
// Read-only tool. Fetches a single market by its id (the Mongo
// document id) or — if you give it a base58 market address — the
// API resolves either form. Use this after pnl_browse_markets to
// drill into one market before reasoning about it.

export const getMarketInputSchema = {
  marketId: z
    .string()
    .min(1)
    .describe(
      "The market id from pnl_browse_markets (the `id` field), or the on-chain market address. The /api/markets/<id> endpoint accepts either.",
    ),
} as const;

const GetMarketInput = z.object(getMarketInputSchema);

function formatSol(lamports: number | null | undefined): string | null {
  if (lamports == null) return null;
  const sol = lamports / 1e9;
  if (sol < 0.001) return null;
  return `${sol.toFixed(sol < 1 ? 3 : 2)} SOL`;
}

export async function callGetMarket(rawInput: unknown) {
  const { marketId } = GetMarketInput.parse(rawInput ?? {});
  const m = await getMarket(marketId);

  const lines: string[] = [];
  const symbol = m.tokenSymbol ? ` ($${m.tokenSymbol})` : '';
  lines.push(`Market: ${m.name}${symbol}`);
  const founder = m.founderDisplayName || m.founderUsername;
  if (founder) lines.push(`Founder: ${founder}`);
  if (m.category) lines.push(`Category: ${m.category}${m.stage ? ` · ${m.stage}` : ''}`);
  if (m.status || m.displayStatus) {
    lines.push(`Status: ${m.displayStatus || m.status}${m.phase ? ` (${m.phase})` : ''}`);
  }
  if (m.yesPercentage != null) {
    lines.push(`YES support: ${Math.round(m.yesPercentage)}%`);
  }
  // The single-market endpoint exposes yesPool/noPool AND totalYesStake/
  // totalNoStake — they should agree, but prefer the explicit pool fields.
  const yesPool = formatSol(m.yesPool ?? m.totalYesStake);
  const noPool = formatSol(m.noPool ?? m.totalNoStake);
  if (yesPool || noPool) {
    lines.push(`Pools: YES ${yesPool ?? '—'} · NO ${noPool ?? '—'}`);
  }
  if (m.targetPool) {
    lines.push(`Target pool: ${m.targetPool}${m.poolProgressPercentage != null ? ` (${Math.round(m.poolProgressPercentage)}% filled)` : ''}`);
  }
  if (m.totalParticipants != null) {
    lines.push(`Voters: ${m.totalParticipants}`);
  }
  if (m.timeLeft) {
    lines.push(`Time left: ${m.timeLeft}`);
  } else if (m.expiryTime) {
    lines.push(`Expires: ${m.expiryTime}`);
  }
  if (m.marketAddress) {
    lines.push(`On-chain market: ${m.marketAddress}`);
  }
  if (m.tokenMint) {
    lines.push(`Token mint: ${m.tokenMint}`);
  }
  if (m.pumpFunTokenAddress) {
    lines.push(`Pump.fun token: ${m.pumpFunTokenAddress}`);
  }
  if (m.description) {
    lines.push('');
    lines.push('Description:');
    lines.push(m.description.trim());
  }
  lines.push('');
  lines.push(`URL: ${marketUrl(m.id)}`);

  lines.push('');
  lines.push('— Raw JSON —');
  lines.push(JSON.stringify(m, null, 2));

  return {
    content: [
      {
        type: 'text' as const,
        text: lines.join('\n'),
      },
    ],
  };
}
