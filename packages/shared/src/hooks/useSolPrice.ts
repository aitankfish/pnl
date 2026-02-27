import { useState, useEffect } from 'react';

interface CoinGeckoPriceResponse {
  solana: {
    usd: number;
  };
}

// Cache for SOL price across all hook instances
let cachedPrice: number | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 60 seconds cache

export function useSolPrice() {
  const [solPrice, setSolPrice] = useState<number | null>(cachedPrice);
  const [isLoading, setIsLoading] = useState(!cachedPrice);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      // Check if cache is still valid
      const now = Date.now();
      if (cachedPrice && now - lastFetchTime < CACHE_DURATION) {
        setSolPrice(cachedPrice);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );

        if (!response.ok) {
          throw new Error('Failed to fetch SOL price');
        }

        const data: CoinGeckoPriceResponse = await response.json();
        const price = data.solana?.usd;

        if (price) {
          cachedPrice = price;
          lastFetchTime = Date.now();
          setSolPrice(price);
          setError(null);
        } else {
          throw new Error('SOL price not found in response');
        }
      } catch (err) {
        console.error('Error fetching SOL price:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to cached price or default
        if (!cachedPrice) {
          cachedPrice = 162.53;
          setSolPrice(162.53);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately only if no cache
    fetchPrice();

    // Refresh price every 60 seconds (increased from 30)
    const interval = setInterval(fetchPrice, 60000);

    return () => clearInterval(interval);
  }, []);

  return { solPrice, isLoading, error };
}
