// Root OG card for docs.pnl.market.
//
// Applies to every docs route that doesn't have a more specific
// opengraph-image.tsx (e.g. the catch-all at /docs/[[...slug]] overrides
// this for individual MDX pages).

import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/app/_og/template';

export const runtime = 'edge';

export const alt = 'PNL — Ideas planted on-chain';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  // Tree mark + brand line only. No domain footer, no wordmark —
  // the tree is the signature, the line is the thesis.
  return renderOgCard({
    title: 'Ideas planted on-chain.',
  });
}
