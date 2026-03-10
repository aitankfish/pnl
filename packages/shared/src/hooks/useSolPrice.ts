/**
 * Hook to fetch SOL price in USD from CoinGecko
 * Uses SWR for global deduplication — all instances share one request
 */

import useSWR from 'swr';

const FALLBACK_PRICE = 162.53;

async function fetchSolPrice(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
  );
  if (!response.ok) throw new Error('Failed to fetch SOL price');
  const data = await response.json();
  const price = data.solana?.usd;
  if (!price) throw new Error('SOL price not found in response');
  return price;
}

export function useSolPrice() {
  const { data: solPrice, error, isLoading } = useSWR(
    'sol-price-usd',
    fetchSolPrice,
    {
      refreshInterval: 120_000, // 2 minutes
      dedupingInterval: 60_000, // dedup within 1 minute
      revalidateOnFocus: false,
      fallbackData: FALLBACK_PRICE,
      errorRetryCount: 2,
      errorRetryInterval: 5000,
    },
  );

  return {
    solPrice: solPrice ?? FALLBACK_PRICE,
    isLoading,
    error: error?.message ?? null,
  };
}
