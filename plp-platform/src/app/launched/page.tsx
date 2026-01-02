'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Rocket, Zap, RefreshCw } from 'lucide-react';
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

export default function LaunchedPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch launched tokens from API
  const { data, error, isLoading, mutate } = useSWR('/api/markets/launched', fetcher, {
    refreshInterval: 60000, // Refresh every 60 seconds
  });

  const launchedTokens: LaunchedToken[] = data?.data?.launched || [];

  // Get unique categories from tokens (normalize to match CATEGORY_CONFIG keys)
  const availableCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    launchedTokens.forEach(t => {
      const cat = t.category?.toLowerCase() || 'other';
      // If category exists in config, use it; otherwise group as 'other'
      if (CATEGORY_CONFIG[cat]) {
        categoriesSet.add(cat);
      } else {
        categoriesSet.add('other');
      }
    });
    return ['all', ...Array.from(categoriesSet)];
  }, [launchedTokens]);

  // Filter tokens by selected category
  const filteredTokens = useMemo(() => {
    if (selectedCategory === 'all') return launchedTokens;
    return launchedTokens.filter(t => {
      const cat = t.category?.toLowerCase() || 'other';
      // Match known categories directly, or group unknown into 'other'
      if (selectedCategory === 'other') {
        return !CATEGORY_CONFIG[cat] || cat === 'other';
      }
      return cat === selectedCategory;
    });
  }, [launchedTokens, selectedCategory]);

  return (
    <div className="pt-3 sm:pt-4 px-3 sm:px-6 pb-6 sm:pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Launched Tokens {launchedTokens.length > 0 && <span className="text-gray-400 font-normal">({launchedTokens.length})</span>}
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
      {launchedTokens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['other'];
            const count = category === 'all'
              ? launchedTokens.length
              : category === 'other'
                ? launchedTokens.filter(t => {
                    const cat = t.category?.toLowerCase() || 'other';
                    return !CATEGORY_CONFIG[cat] || cat === 'other';
                  }).length
                : launchedTokens.filter(t => (t.category?.toLowerCase() || 'other') === category).length;
            const isSelected = selectedCategory === category;

            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
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
      {isLoading && (
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
      {!isLoading && !error && launchedTokens.length === 0 && (
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
      {!isLoading && !error && launchedTokens.length > 0 && (
        <LaunchedTable tokens={filteredTokens} />
      )}
    </div>
  );
}
