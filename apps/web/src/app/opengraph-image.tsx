// Root OG card for pnl.market.
//
// Applies to every route on the live app that doesn't have a more
// specific opengraph-image.tsx (per-market, per-research, etc.).

import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/app/_og/template';

export const runtime = 'edge';

export const alt = 'PNL — Plant the idea, watch it grow';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgCard({
    title: 'Plant the idea. Watch it grow.',
  });
}
