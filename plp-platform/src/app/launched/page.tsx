'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rocket, Zap, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { LaunchedTable } from '@/components/LaunchedTable';

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Type for launched token
interface LaunchedToken {
  id: string;
  marketAddress: string;
  name: string;
  symbol: string;
  description: string;
  category: string;
  stage?: string;
  projectType?: string;
  launchDate: string;
  tokenAddress: string;
  projectImageUrl?: string;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  yesPercentage: number;
  launchPool: string;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  discord?: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// Category display names and colors
const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  'all': { label: 'All', color: 'from-gray-500/20 to-gray-500/10 border-gray-500/30 text-gray-300' },
  // Web3 & Crypto
  'defi': { label: 'DeFi', color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-300' },
  'nft': { label: 'NFT', color: 'from-violet-500/20 to-purple-500/10 border-violet-500/30 text-violet-300' },
  'gaming': { label: 'Gaming', color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-300' },
  'dao': { label: 'DAO', color: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/30 text-indigo-300' },
  'ai': { label: 'AI/ML', color: 'from-cyan-500/20 to-teal-500/10 border-cyan-500/30 text-cyan-300' },
  'infrastructure': { label: 'Infra', color: 'from-orange-500/20 to-amber-500/10 border-orange-500/30 text-orange-300' },
  'social': { label: 'Social', color: 'from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-300' },
  'meme': { label: 'Meme', color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-300' },
  'creator': { label: 'Creator', color: 'from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/30 text-fuchsia-300' },
  // Traditional
  'healthcare': { label: 'Healthcare', color: 'from-red-500/20 to-rose-500/10 border-red-500/30 text-red-300' },
  'science': { label: 'Science', color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-300' },
  'education': { label: 'Education', color: 'from-sky-500/20 to-blue-500/10 border-sky-500/30 text-sky-300' },
  'finance': { label: 'Finance', color: 'from-green-500/20 to-emerald-500/10 border-green-500/30 text-green-300' },
  'commerce': { label: 'Commerce', color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-300' },
  'realestate': { label: 'Real Estate', color: 'from-stone-500/20 to-gray-500/10 border-stone-500/30 text-stone-300' },
  'energy': { label: 'Energy', color: 'from-lime-500/20 to-green-500/10 border-lime-500/30 text-lime-300' },
  'media': { label: 'Media', color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-300' },
  'manufacturing': { label: 'Manufacturing', color: 'from-slate-500/20 to-gray-500/10 border-slate-500/30 text-slate-300' },
  'mobility': { label: 'Mobility', color: 'from-teal-500/20 to-cyan-500/10 border-teal-500/30 text-teal-300' },
  'other': { label: 'Other', color: 'from-gray-500/20 to-slate-500/10 border-gray-500/30 text-gray-300' },
};

const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100];

export default function LaunchedPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Build API URL with pagination params
  const apiUrl = `/api/markets/launched?page=${page}&limit=${itemsPerPage}${selectedCategory !== 'all' ? `&category=${selectedCategory}` : ''}`;

  // Fetch launched tokens from API with pagination
  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher, {
    refreshInterval: 60000, // Refresh every 60 seconds
    keepPreviousData: true, // Keep showing old data while fetching new page
  });

  const launchedTokens: LaunchedToken[] = data?.data?.launched || [];
  const totalCount: number = data?.data?.total || 0;
  const pagination: PaginationInfo = data?.data?.pagination || { page: 1, limit: 25, totalPages: 1, hasMore: false };

  // Also fetch total counts for category filters (without pagination)
  const { data: allData } = useSWR('/api/markets/launched?limit=1000', fetcher, {
    refreshInterval: 120000, // Less frequent for counts
  });
  const allTokens: LaunchedToken[] = allData?.data?.launched || [];

  // Get category counts from all tokens
  const getCategoryCount = (category: string) => {
    if (category === 'all') return allData?.data?.total || totalCount;
    if (category === 'other') {
      return allTokens.filter(t => {
        const cat = t.category?.toLowerCase() || 'other';
        return !CATEGORY_CONFIG[cat] || cat === 'other';
      }).length;
    }
    return allTokens.filter(t => (t.category?.toLowerCase() || 'other') === category).length;
  };

  // Get available categories from all tokens
  const availableCategories = (() => {
    if (allTokens.length === 0) return ['all'];
    const categoriesSet = new Set<string>();
    allTokens.forEach(t => {
      const cat = t.category?.toLowerCase() || 'other';
      if (CATEGORY_CONFIG[cat]) {
        categoriesSet.add(cat);
      } else {
        categoriesSet.add('other');
      }
    });
    return ['all', ...Array.from(categoriesSet)];
  })();

  // Handle category change - reset to page 1
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
  };

  // Handle items per page change - reset to page 1
  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setPage(1);
  };

  // Pagination helpers
  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalCount);

  return (
    <div className="pt-3 sm:pt-4 px-3 sm:px-6 pb-6 sm:pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Launched Tokens {totalCount > 0 && <span className="text-gray-400 font-normal">({totalCount})</span>}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => mutate()}
            variant="outline"
            size="sm"
            className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <Link href="/create">
              <Zap className="w-4 h-4 mr-2" />
              Launch Token
            </Link>
          </Button>
        </div>
      </div>

      {/* Category Filters */}
      {(allTokens.length > 0 || launchedTokens.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['other'];
            const count = getCategoryCount(category);
            const isSelected = selectedCategory === category;

            return (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isSelected
                    ? `bg-gradient-to-r ${config.color} border-opacity-100`
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Loading State */}
      {isLoading && launchedTokens.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            </div>
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s', animationDelay: '-0.5s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
            </div>
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s', animationDelay: '-1s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
            </div>
          </div>
          <span className="text-white/70">Loading launched tokens...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-20">
          <p className="text-red-400">Failed to load launched tokens. Please try again later.</p>
          <Button
            onClick={() => mutate()}
            variant="outline"
            className="mt-4 border-white/20 text-white hover:bg-white/10"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && totalCount === 0 && (
        <div className="text-center py-20">
          <Rocket className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">No Launched Tokens Yet</h3>
          <p className="text-white/70 mb-6">
            Be the first to create a successful prediction market and launch a token!
          </p>
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <Link href="/create">
              <Zap className="w-5 h-5 mr-2" />
              Create Market
            </Link>
          </Button>
        </div>
      )}

      {/* Token Table */}
      {!error && (launchedTokens.length > 0 || (isLoading && totalCount > 0)) && (
        <>
          <LaunchedTable tokens={launchedTokens} isLoading={isLoading && launchedTokens.length === 0} />

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
              {/* Items per page */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-500"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map(option => (
                    <option key={option} value={option} className="bg-gray-900">
                      {option}
                    </option>
                  ))}
                </select>
                <span>per page</span>
              </div>

              {/* Page info */}
              <div className="text-sm text-gray-400">
                Showing {startItem}-{endItem} of {totalCount}
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          page === pageNum
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasMore}
                  className="border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(pagination.totalPages)}
                  disabled={page === pagination.totalPages}
                  className="border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
