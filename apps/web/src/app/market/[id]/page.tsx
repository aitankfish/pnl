/**
 * Market detail page — thin server component.
 *
 * Fetches market data on the server (deduped with layout.tsx's
 * generateMetadata via React's `cache()`), then hands it to the client
 * component as `initialMarket`. The client component owns all the hooks,
 * realtime subscriptions, and the bulk of the UI; this file exists purely
 * to eliminate the flash-of-loading by SSR'ing the initial market state.
 *
 * If the server fetch fails, we still pass `null` — the client surface
 * has its own error state and will retry the fetch from the browser.
 * That keeps transient API hiccups from 404'ing the page.
 */
import { getMarket } from './_data';
import MarketDetailClient from './MarketDetailClient';

export default async function MarketDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialMarket = await getMarket(id);
  return <MarketDetailClient initialMarket={initialMarket as any} />;
}
