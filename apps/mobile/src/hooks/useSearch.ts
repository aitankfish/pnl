import { useState, useEffect, useRef } from 'react';
import { apiUrl } from '@pnl/shared/utils';

export interface SearchUserResult {
  type: 'user';
  walletAddress: string;
  username: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
  reputationScore: number;
  followerCount: number;
}

export interface SearchMarketResult {
  type: 'market';
  id: string;
  marketAddress: string;
  marketName: string;
  marketDescription: string;
  marketState: number;
  projectName: string;
  projectImageUrl: string | null;
  tokenSymbol: string | null;
}

export interface SearchResults {
  users: SearchUserResult[];
  markets: SearchMarketResult[];
}

const EMPTY: SearchResults = { users: [], markets: [] };

export function useSearch(query: string, limit = 5) {
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults(EMPTY);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`),
        );
        const data = await res.json();
        if (data.success) {
          setResults({
            users: data.data.users || [],
            markets: data.data.markets || [],
          });
        }
      } catch {
        // silently fail — keep previous results
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, limit]);

  const totalResults = results.users.length + results.markets.length;

  return { results, isSearching, totalResults };
}
