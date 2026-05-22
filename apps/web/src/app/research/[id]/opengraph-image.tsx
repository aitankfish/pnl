// Per-research-paper OG card.
//
// /research/<id> share cards pull the paper title + author from the
// public read API. Same template as everything else.

import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/app/_og/template';

export const runtime = 'edge';
export const revalidate = 600;

export const alt = 'PNL research';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';

type ResearchResponse = {
  paper?: {
    title?: string;
    authorName?: string;
    authorXHandle?: string | null;
    authorWallet?: string;
  };
};

export default async function Image({ params }: { params: { id: string } }) {
  let paper: ResearchResponse['paper'] = undefined;
  try {
    const res = await fetch(`${BASE_URL}/api/research/${encodeURIComponent(params.id)}`, {
      next: { revalidate: 600 },
    });
    if (res.ok) {
      const data = (await res.json()) as ResearchResponse;
      paper = data.paper;
    }
  } catch {
    // Quiet fallback — render the brand card if the API hiccups.
  }

  if (!paper?.title) {
    return renderOgCard({ title: 'Plant the idea. Watch it grow.' });
  }

  const author = paper.authorXHandle
    ? `by @${paper.authorXHandle.replace(/^@/, '')}`
    : paper.authorName
    ? `by ${paper.authorName}`
    : undefined;

  return renderOgCard({
    title: paper.title,
    subtitle: author,
    footer: 'Research · pnl.market',
  });
}
