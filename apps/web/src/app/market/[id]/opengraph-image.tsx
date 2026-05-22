// Per-market OG card.
//
// /market/<id> share cards pull the live market state from the public
// read API and render: market name as headline, founder + status as
// italic subtitle, and a mono footer with the YES%/volume/votes badge.
// Twitter/X caches these aggressively (re-scrape weekly), so the card
// is a snapshot rather than live — that's the platform reality.

import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/app/_og/template';

export const runtime = 'edge';
// Re-generate every 5 minutes so a refreshed scrape picks up the
// updated YES% / volume on hot markets.
export const revalidate = 300;

export const alt = 'PNL market';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';

type MarketResponse = {
  name?: string;
  description?: string;
  founderDisplayName?: string;
  founderUsername?: string;
  participants?: number;
  yesPool?: number | null;
  noPool?: number | null;
  yesPercentage?: number | null;
  status?: string;
  displayStatus?: string;
};

function formatSol(pool: number | null | undefined): string | null {
  if (pool == null) return null;
  const sol = pool / 1e9; // lamports to SOL
  if (sol < 0.01) return null;
  return `${sol.toFixed(sol < 1 ? 2 : 1)} SOL`;
}

function statusLabel(status: string | undefined, displayStatus: string | undefined): string {
  const s = displayStatus ?? status ?? '';
  if (s.toLowerCase().includes('yes')) return 'YES won';
  if (s.toLowerCase().includes('no')) return 'NO won';
  if (s.toLowerCase().includes('resolved')) return 'Resolved';
  if (s.toLowerCase().includes('expired')) return 'Expired';
  if (s.toLowerCase().includes('refund')) return 'Refunded';
  return 'Live now';
}

export default async function Image({ params }: { params: { id: string } }) {
  let market: MarketResponse | null = null;
  try {
    const res = await fetch(`${BASE_URL}/api/markets/${encodeURIComponent(params.id)}`, {
      // The public API itself caches; we just want a recent-enough snapshot.
      next: { revalidate: 300 },
    });
    if (res.ok) {
      market = await res.json();
    }
  } catch {
    // Network blip on the OG render path — fall through to the brand card.
  }

  if (!market || !market.name) {
    return renderOgCard({ title: 'Plant the idea. Watch it grow.' });
  }

  const title = market.name;
  const founder = market.founderDisplayName || market.founderUsername;
  const subtitle = founder ? `by ${founder}` : market.description;

  // Build a compact stats line for the bottom badge.
  // Examples: "Live now · 67% YES · 4.2 SOL · 12 votes"
  //           "YES won · 89% YES · 18 votes"
  const bits: string[] = [statusLabel(market.status, market.displayStatus)];
  if (market.yesPercentage != null) {
    bits.push(`${Math.round(market.yesPercentage)}% YES`);
  }
  const totalPool = (market.yesPool ?? 0) + (market.noPool ?? 0);
  const solStr = formatSol(totalPool);
  if (solStr) bits.push(solStr);
  if (market.participants != null && market.participants > 0) {
    bits.push(`${market.participants} ${market.participants === 1 ? 'vote' : 'votes'}`);
  }

  return renderOgCard({
    title,
    subtitle,
    footer: bits.join(' · '),
  });
}
