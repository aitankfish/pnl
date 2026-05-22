import { z } from 'zod';
import { getMarket, marketUrl } from '../lib/pnl-api.js';
import { Badge, headline, kvTable, quote, next, reply, truncAddress, code } from '../lib/output.js';

export const getMarketInputSchema = {
  marketId: z
    .string()
    .min(1)
    .describe(
      "The market id (from pnl_browse_markets) or the on-chain base58 market address. The /api/markets/<id> endpoint accepts either.",
    ),
} as const;

const GetMarketInput = z.object(getMarketInputSchema);

function fmtSol(lamports: number | null | undefined): string | null {
  if (lamports == null) return null;
  const sol = lamports / 1e9;
  if (sol < 0.001) return null;
  return `${sol.toFixed(sol < 1 ? 3 : 2)} SOL`;
}

function statusBadge(status?: string, displayStatus?: string): string {
  const s = (displayStatus || status || '').toLowerCase();
  if (s.includes('active')) return Badge.live;
  if (s.includes('yes')) return 'YES won';
  if (s.includes('no')) return 'NO won';
  if (s.includes('refund')) return 'refunded';
  if (s.includes('expired') || s.includes('awaiting')) return Badge.pending;
  return displayStatus || status || '—';
}

export async function callGetMarket(rawInput: unknown) {
  const { marketId } = GetMarketInput.parse(rawInput ?? {});
  const m = await getMarket(marketId);

  const symbol = m.tokenSymbol ? `$${m.tokenSymbol}` : '';
  const yesPct = m.yesPercentage != null ? `${Math.round(m.yesPercentage)}% YES` : '';
  const status = statusBadge(m.status, m.displayStatus);
  const headerBits = [m.name, symbol && `· ${symbol}`, status && `· ${status}`, yesPct && `· ${yesPct}`]
    .filter(Boolean)
    .join(' ');

  const founder = m.founderDisplayName || m.founderUsername;
  const yesPool = fmtSol(m.yesPool ?? m.totalYesStake);
  const noPool = fmtSol(m.noPool ?? m.totalNoStake);

  return reply(
    headline(headerBits),
    kvTable([
      ['Founder', founder ?? null],
      ['Category', [m.category, m.stage].filter(Boolean).join(' · ') || null],
      ['Status', `${status}${m.phase ? ` (${m.phase})` : ''}`],
      ['YES support', m.yesPercentage != null ? `${Math.round(m.yesPercentage)}%` : null],
      ['Pools', yesPool || noPool ? `YES ${yesPool ?? '—'} · NO ${noPool ?? '—'}` : null],
      ['Target pool', m.targetPool ? `${m.targetPool}${m.poolProgressPercentage != null ? ` (${Math.round(m.poolProgressPercentage)}% filled)` : ''}` : null],
      ['Voters', m.totalParticipants != null ? String(m.totalParticipants) : null],
      ['Time left', m.timeLeft ?? (m.expiryTime ? m.expiryTime : null)],
      ['On-chain market', m.marketAddress ? `\`${truncAddress(m.marketAddress, 8, 6)}\`` : null],
      ['Token mint', m.tokenMint ? `\`${truncAddress(m.tokenMint, 8, 6)}\`` : null],
      ['Pump.fun token', m.pumpFunTokenAddress ? `\`${truncAddress(m.pumpFunTokenAddress, 8, 6)}\`` : null],
    ]),
    m.description ? quote(m.description.trim()) : null,
    `**Open on PNL:** ${marketUrl(m.id)}`,
    m.marketAddress ? code(m.marketAddress) : null,
    next('`/pnl-vote` to stake YES/NO (coming in Phase B), or share the URL.'),
  );
}
