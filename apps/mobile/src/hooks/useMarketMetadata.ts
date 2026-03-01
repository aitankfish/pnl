/**
 * useMarketMetadata — Lazy-fetches IPFS metadata for a single market.
 * Only fetches when marketId is non-null, reuses SWR cache from useMarket.
 */

import useSWR from 'swr';
import { fetcher, ApiResponse } from '@pnl/shared/services';

interface MarketMetadata {
  videoUrl?: string;
  [key: string]: any;
}

interface MarketWithMetadata {
  metadata?: MarketMetadata;
  [key: string]: any;
}

export function useMarketMetadata(marketId: string | null) {
  const { data, isLoading } = useSWR<ApiResponse<MarketWithMetadata>>(
    marketId ? `/api/markets/${marketId}` : null,
    fetcher,
    { dedupingInterval: 30000 },
  );

  const videoUrl = data?.data?.metadata?.videoUrl ?? null;

  return { videoUrl, isLoading };
}
