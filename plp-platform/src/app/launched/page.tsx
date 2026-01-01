'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Rocket, Zap, TrendingUp, RefreshCw } from 'lucide-react';
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

export default function LaunchedPage() {
  // Fetch launched tokens from API
  const { data, error, isLoading, mutate } = useSWR('/api/markets/launched', fetcher, {
    refreshInterval: 60000, // Refresh every 60 seconds
  });

  const launchedTokens: LaunchedToken[] = data?.data?.launched || [];

  return (
    <div className="pt-3 sm:pt-4 px-3 sm:px-6 pb-6 sm:pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            PNL Token Screener
          </h1>
          <p className="text-gray-400 text-sm">
            Community-validated tokens launched through prediction markets
          </p>
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

      {/* Stats Bar */}
      {launchedTokens.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-green-500/10 to-cyan-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase mb-1">Total Tokens</div>
            <div className="text-2xl font-bold text-white">{launchedTokens.length}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase mb-1">Total Raised</div>
            <div className="text-2xl font-bold text-white">
              {launchedTokens.reduce((sum, t) => sum + (parseFloat(t.launchPool) || 0), 0).toFixed(1)} SOL
            </div>
          </div>
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase mb-1">Total Votes</div>
            <div className="text-2xl font-bold text-white">
              {launchedTokens.reduce((sum, t) => sum + (t.totalVotes || 0), 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase mb-1">Avg YES Rate</div>
            <div className="text-2xl font-bold text-green-400">
              {launchedTokens.length > 0
                ? (launchedTokens.reduce((sum, t) => sum + (t.yesPercentage || 0), 0) / launchedTokens.length).toFixed(0)
                : 0}%
            </div>
          </div>
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
        <LaunchedTable tokens={launchedTokens} />
      )}

      {/* Call to Action */}
      {launchedTokens.length > 0 && (
        <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10 border border-purple-500/20 rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Launch Your Own Token</h2>
          <p className="text-gray-300 text-sm sm:text-base mb-6 max-w-xl mx-auto">
            Create a prediction market and let the community validate your project before launch.
            If YES wins, your token gets launched automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              <Link href="/create">
                <Zap className="w-5 h-5 mr-2" />
                Start Your Launch
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:border-white/30"
            >
              <Link href="/browse">
                <TrendingUp className="w-5 h-5 mr-2" />
                Browse Active Markets
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
