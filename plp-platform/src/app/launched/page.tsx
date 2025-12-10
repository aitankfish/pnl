'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Rocket,
  TrendingUp,
  ExternalLink,
  Zap,
  Loader2,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

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
  const [sortBy, setSortBy] = useState<string>('Newest First');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Fetch launched tokens from API
  const { data, error, isLoading } = useSWR('/api/markets/launched', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  const rawLaunchedProjects: LaunchedToken[] = data?.data?.launched || [];

  // Sort options
  const sortOptions = ['Newest First', 'Oldest First', 'Highest Pool', 'Most Votes', 'Highest YES%'];

  // Get unique categories from launched projects
  const categories = useMemo(() => {
    const uniqueCategories = new Set(rawLaunchedProjects.map(p => p.category));
    return ['All', ...Array.from(uniqueCategories).sort()];
  }, [rawLaunchedProjects]);

  // Filtered and sorted projects
  const launchedProjects = useMemo(() => {
    // First filter by category
    let projects = [...rawLaunchedProjects];
    if (selectedCategory !== 'All') {
      projects = projects.filter(p => p.category === selectedCategory);
    }

    // Then sort
    switch (sortBy) {
      case 'Newest First':
        return projects.sort((a, b) => new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime());
      case 'Oldest First':
        return projects.sort((a, b) => new Date(a.launchDate).getTime() - new Date(b.launchDate).getTime());
      case 'Highest Pool':
        return projects.sort((a, b) => parseFloat(b.launchPool) - parseFloat(a.launchPool));
      case 'Most Votes':
        return projects.sort((a, b) => b.totalVotes - a.totalVotes);
      case 'Highest YES%':
        return projects.sort((a, b) => b.yesPercentage - a.yesPercentage);
      default:
        return projects;
    }
  }, [rawLaunchedProjects, sortBy, selectedCategory]);

  // Helper function to truncate token address
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Helper function to get Helius Orb link
  const getSolscanLink = (address: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '';
    return `https://orb.helius.dev/address/${address}${network}`;
  };

  // Helper function to get Pump.fun link
  const getPumpFunLink = (address: string) => {
    return `https://pump.fun/${address}`;
  };

  return (
    <div className="p-6 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-lg sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400 tracking-tight">
            Community-backed tokens. Now live on Solana.
          </h1>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="ml-3 text-white/70">Loading launched projects...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-20">
            <p className="text-red-400">Failed to load launched projects. Please try again later.</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && launchedProjects.length === 0 && (
          <div className="text-center py-20">
            <Rocket className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">No Launched Projects Yet</h3>
            <p className="text-white/70 mb-6">
              Be the first to create a successful prediction market and launch a token!
            </p>
            <Button asChild size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              <Link href="/create">
                <Zap className="w-5 h-5 mr-2" />
                Create Market
              </Link>
            </Button>
          </div>
        )}

        {/* Projects Grid */}
        {!isLoading && !error && launchedProjects.length > 0 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Live ({launchedProjects.length})</h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Category Filter */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <span className="text-xs sm:text-sm text-gray-400 font-medium hidden sm:inline">Category:</span>
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[120px] sm:w-[140px] bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors text-sm">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/20">
                      {categories.map((category) => (
                        <SelectItem
                          key={category}
                          value={category}
                          className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                        >
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-400 font-medium hidden sm:inline">Sort:</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[120px] sm:w-[140px] bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors text-sm">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/20">
                      {sortOptions.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                          className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                        >
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {launchedProjects.map((project) => (
              <Link key={project.id} href={`/market/${project.id}`} className="block">
                <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white hover:bg-white/10 transition-all duration-300 hover:scale-102 group cursor-pointer">
                  <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {project.projectImageUrl ? (
                          <img
                            src={project.projectImageUrl}
                            alt={project.name}
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-cyan-500 rounded-xl flex items-center justify-center">
                            <Rocket className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-white group-hover:text-green-300 transition-colors">
                            {project.name}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs">
                              {project.symbol}
                            </Badge>
                            <Badge className="bg-green-500/20 text-green-300 border-green-400/30 text-xs">
                              {project.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                        {project.description}
                      </p>
                    </div>
                  </div>

                  {/* Launch Stats */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-gray-400 text-xs">Pool Raised</div>
                      <div className="font-bold text-white text-lg">{project.launchPool}</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-gray-400 text-xs">YES Rate</div>
                      <div className="font-bold text-green-400 text-lg">{project.yesPercentage}%</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-gray-400 text-xs">Total Votes</div>
                      <div className="font-bold text-white">{project.totalVotes}</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-gray-400 text-xs">Launch Date</div>
                      <div className="font-bold text-white text-xs">{project.launchDate}</div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Token Address */}
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-gray-400 mb-1">Token Address</div>
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-white font-mono">{truncateAddress(project.tokenAddress)}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => {
                          navigator.clipboard.writeText(project.tokenAddress);
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600"
                    >
                      <a href={getPumpFunLink(project.tokenAddress)} target="_blank" rel="noopener noreferrer">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Trade on Pump.fun
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="flex-1 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
                    >
                      <a href={getSolscanLink(project.tokenAddress)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Solscan
                      </a>
                    </Button>
                  </div>

                  {/* Social Links (if available) */}
                  {(project.website || project.twitter || project.telegram || project.discord) && (
                    <div className="flex gap-2 pt-2 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                      {project.website && (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                        >
                          <a href={project.website} target="_blank" rel="noopener noreferrer">
                            Website
                          </a>
                        </Button>
                      )}
                      {project.twitter && (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                        >
                          <a href={project.twitter} target="_blank" rel="noopener noreferrer">
                            Twitter
                          </a>
                        </Button>
                      )}
                      {project.telegram && (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                        >
                          <a href={project.telegram} target="_blank" rel="noopener noreferrer">
                            Telegram
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
            ))}
          </div>
        </div>
        )}

        {/* Call to Action */}
        <div className="text-center space-y-6 py-12">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">Want to Launch Your Own Token?</h2>
            <p className="text-white/70 text-lg mb-6">
              Create a prediction market and let the community decide if your project deserves a token launch.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Link href="/create">
                  <Zap className="w-5 h-5 mr-2" />
                  Launch Your Project
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:border-white/30">
                <Link href="/browse">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Browse Active Markets
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}
