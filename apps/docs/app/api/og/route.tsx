// OG image endpoint for docs.pnl.market.
//
// Used by the per-page metadata (apps/docs/app/docs/[[...slug]]/page.tsx)
// because we can't colocate an opengraph-image.tsx inside the optional
// catch-all without tripping a Next.js route-sort bug. The catch-all's
// generateMetadata builds a /api/og?title=&subtitle= URL with the page's
// frontmatter and points openGraph.images at it.
//
// Renders through the shared template so every share card looks the same.

import { NextRequest } from 'next/server';
import { renderOgCard } from '@/app/_og/template';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get('title') || 'Ideas planted on-chain.';
  const subtitle = searchParams.get('subtitle') || searchParams.get('description') || undefined;
  const footer = searchParams.get('footer') || undefined;

  return renderOgCard({ title, subtitle, footer });
}
