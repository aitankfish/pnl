'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, Target, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: 'user' | 'market';
  // User fields
  walletAddress?: string;
  username?: string | null;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  reputationScore?: number;
  followerCount?: number;
  // Market fields
  id?: string;
  marketAddress?: string;
  marketName?: string;
  marketDescription?: string;
  projectName?: string;
  projectImageUrl?: string | null;
  tokenSymbol?: string | null;
}

export default function GlobalSearch() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ users: SearchResult[]; markets: SearchResult[] }>({
    users: [],
    markets: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], markets: [] });
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();

        if (data.success) {
          setResults({
            users: data.data.users || [],
            markets: data.data.markets || [],
          });
          setShowResults(true);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    setQuery('');
    setResults({ users: [], markets: [] });
    setShowResults(false);
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'user') {
      router.push(`/profile/${result.walletAddress}`);
    } else if (result.type === 'market') {
      router.push(`/market/${result.id}`);
    }
    handleCollapse();
  };

  const totalResults = results.users.length + results.markets.length;

  return (
    <div ref={searchRef} className="relative">
      {!isExpanded ? (
        // Collapsed state - just an icon
        <button
          onClick={handleExpand}
          className="flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 flex-shrink-0"
          title="Search users and markets"
        >
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      ) : (
        // Expanded state - search bar
        <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl px-2 sm:px-3 h-9 sm:h-12 w-[140px] sm:w-[280px] border border-white/20">
          <Search className="w-4 h-4 text-white/70 mr-2 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-white placeholder-white/50 outline-none text-sm"
          />
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-white/70 animate-spin ml-2 flex-shrink-0" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="ml-2 text-white/70 hover:text-white flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      )}

      {/* Search Results Dropdown */}
      {showResults && isExpanded && totalResults > 0 && (
        <div className="fixed sm:absolute top-[60px] sm:top-full left-4 right-4 sm:left-auto sm:right-0 mt-0 sm:mt-2 w-auto sm:w-[400px] max-h-[50vh] sm:max-h-[500px] overflow-y-auto bg-gray-900/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl z-[100]">
          {/* Users Section */}
          {results.users.length > 0 && (
            <div className="p-2 sm:p-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2 flex items-center">
                <User className="w-3 h-3 mr-1" />
                Users ({results.users.length})
              </h3>
              <div className="space-y-1">
                {results.users.map((user) => (
                  <button
                    key={user.walletAddress}
                    onClick={() => handleResultClick(user)}
                    className="w-full flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {user.profilePhotoUrl ? (
                        <img src={user.profilePhotoUrl} alt={user.username || 'User'} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">
                        {user.username || 'Anonymous'}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {user.walletAddress?.slice(0, 8)}...{user.walletAddress?.slice(-6)}
                      </div>
                      {user.bio && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">{user.bio}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2 flex-shrink-0">
                      <span>{user.followerCount} followers</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Markets Section */}
          {results.markets.length > 0 && (
            <div className="p-2 sm:p-3 border-t border-white/10">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2 flex items-center">
                <Target className="w-3 h-3 mr-1" />
                Markets ({results.markets.length})
              </h3>
              <div className="space-y-1">
                {results.markets.map((market) => (
                  <button
                    key={market.id}
                    onClick={() => handleResultClick(market)}
                    className="w-full flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-r from-green-500 to-cyan-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {market.projectImageUrl ? (
                        <img src={market.projectImageUrl} alt={market.projectName} className="w-full h-full object-cover" />
                      ) : (
                        <Target className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">
                        {market.marketName}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {market.projectName}
                        {market.tokenSymbol && <span className="ml-1">• {market.tokenSymbol}</span>}
                      </div>
                      {market.marketDescription && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">{market.marketDescription}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0">
                      {market.marketState === 0 ? 'Active' : market.marketState === 1 ? 'Resolved' : 'Closed'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {showResults && isExpanded && totalResults === 0 && query.trim() && !isSearching && (
        <div className="fixed sm:absolute top-[60px] sm:top-full left-4 right-4 sm:left-auto sm:right-0 mt-0 sm:mt-2 w-auto sm:w-[300px] bg-gray-900/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl p-3 sm:p-4 text-center z-[100]">
          <Search className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No results found for &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  );
}
