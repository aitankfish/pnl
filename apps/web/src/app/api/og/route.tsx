// Legacy OG image endpoint.
//
// New code should let Next.js auto-discover the opengraph-image.tsx files
// (root, /market/[id], /research/[id], etc.) — those produce per-page
// cards. This route still exists because:
//   1. Old shared links and the docs.pnl.market layout still point at it
//   2. It accepts ?title=&description= overrides for ad-hoc one-off shares
//
// Renders through the shared template so the visual matches every other
// share card on the protocol.

import { NextRequest } from 'next/server';
import { renderOgCard } from '@/app/_og/template';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get('title') || 'Plant the idea. Watch it grow.';
  const subtitle = searchParams.get('subtitle') || searchParams.get('description') || undefined;
  const footer = searchParams.get('footer') || undefined;

  return renderOgCard({ title, subtitle, footer });
}
