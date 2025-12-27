'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  TrendingUp,
  BarChart3,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  Rocket,
  Activity,
  Target,
  Award,
  Loader2
} from 'lucide-react';

interface Market {
  id: string;
  marketAddress: string;
  name: string;
  description: string;
  category: string;
  stage: string;
  tokenSymbol: string;
  targetPool: string;
  yesVotes: number;
  noVotes: number;
  totalYesStake: number;
  totalNoStake: number;
  timeLeft: string;
  expiryTime: string;
  status: string;
  metadataUri?: string;
  projectImageUrl?: string;
  resolution?: string;
  poolBalance?: number;
}

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

// Format category and stage for proper display
function formatLabel(value: string): string {
  const uppercaseValues: { [key: string]: string } = {
    'dao': 'DAO',
    'nft': 'NFT',
    'ai': 'AI/ML',
    'defi': 'DeFi',
    'mvp': 'MVP',
    'realestate': 'Real Estate',
    'real estate': 'Real Estate'
  };

  if (uppercaseValues[value.toLowerCase()]) {
    return uppercaseValues[value.toLowerCase()];
  }

  // Capitalize first letter of each word
  return value
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default function LaunchpadPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [launchedProjects, setLaunchedProjects] = useState<LaunchedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLaunched, setLoadingLaunched] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Update document title
    document.title = 'P&L - Predict and Launch';
  }, []);

  useEffect(() => {
    fetchMarkets();
    fetchLaunchedProjects();
  }, []);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/markets/list');
      const result = await response.json();

      if (result.success) {
        setMarkets(result.data.markets);
      } else {
        setError(result.error || 'Failed to load markets');
      }
    } catch (err) {
      console.error('Error fetching markets:', err);
      setError('Failed to load markets');
    } finally {
      setLoading(false);
    }
  };

  const fetchLaunchedProjects = async () => {
    try {
      setLoadingLaunched(true);
      const response = await fetch('/api/markets/launched');
      const result = await response.json();

      if (result.success) {
        setLaunchedProjects(result.data.launched || []);
      }
    } catch (err) {
      console.error('Error fetching launched projects:', err);
    } finally {
      setLoadingLaunched(false);
    }
  };

  // Calculate real statistics from markets
  // Filter only active markets (Unresolved resolution)
  const activeMarkets = markets.filter(m => m.resolution === 'Unresolved' || !m.resolution);

  const totalVotes = markets.reduce((sum, m) => sum + m.yesVotes + m.noVotes, 0);

  // Use actual poolBalance (total staked) instead of targetPool
  const totalVolume = markets.reduce((sum, m) => {
    // poolBalance is in lamports, convert to SOL (or use totalYesStake + totalNoStake)
    const actualStaked = m.totalYesStake + m.totalNoStake;
    return sum + actualStaked;
  }, 0);

  const activeProjects = activeMarkets.length;

  // Helper function to format launch date
  const formatLaunchDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="pt-3 sm:pt-4 px-3 sm:px-6 pb-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Mission Control
            </span>
          </h1>
          <p className="text-white/70">
            Monitor prediction markets, track statistics, and explore launched projects
          </p>
        </div>

        {/* Three Vertical Containers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Container 1: Prediction Markets */}
          <div className="space-y-4">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Target className="w-5 h-5 text-cyan-400" />
                  <span>Prediction Markets</span>
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Active YES/NO voting on upcoming projects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full border border-white/10" />
                      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s' }}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                      </div>
                      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s', animationDelay: '-0.5s' }}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                      </div>
                      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s', animationDelay: '-1s' }}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                      </div>
                    </div>
                    <span className="text-white/70 text-sm">Loading markets...</span>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                ) : activeMarkets.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/70 text-sm">No active markets yet</p>
                  </div>
                ) : (
                  activeMarkets.slice(0, 4).map((market) => {
                    const totalVotes = market.yesVotes + market.noVotes;
                    const yesPercentage = totalVotes > 0 ? Math.round((market.yesVotes / totalVotes) * 100) : 0;

                    return (
                      <Link href={`/market/${market.id}`} key={market.id} prefetch={true}>
                        <div className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-102 group cursor-pointer">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                                {market.name}
                              </h3>
                              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{market.description}</p>
                              <Badge className="mt-2 bg-purple-500/20 text-purple-300 border-purple-400/30">
                                {formatLabel(market.category)}
                              </Badge>
                            </div>
                            <div className="text-right ml-2">
                              <div className="text-xs text-gray-400 mb-1">Time Left</div>
                              <div className="text-sm font-medium text-white">{market.timeLeft}</div>
                            </div>
                          </div>

                          {/* Voting Progress */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-green-400">YES</span>
                                <span className="text-white font-medium">{market.yesVotes}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-white font-medium">{market.noVotes}</span>
                                <span className="text-red-400">NO</span>
                                <XCircle className="w-4 h-4 text-red-400" />
                              </div>
                            </div>

                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-green-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${yesPercentage}%` }}
                              ></div>
                            </div>

                            <div className="text-center">
                              <span className="text-lg font-bold text-white">{yesPercentage}%</span>
                              <span className="text-sm text-gray-400 ml-1">YES</span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            disabled={isPending}
                            className="w-full mt-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-70 disabled:cursor-not-allowed"
                            onClick={(e) => {
                              e.preventDefault();
                              startTransition(() => {
                                router.push(`/market/${market.id}`);
                              });
                            }}
                          >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vote Now'}
                          </Button>
                        </div>
                      </Link>
                    );
                  })
                )}
                
                <Button asChild variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 hover:border-white/30">
                  <Link href="/browse" prefetch={true}>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    View All Markets
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Container 2: Statistics */}
          <div className="space-y-4">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  <span>Platform Statistics</span>
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Real-time metrics and performance data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                              <Activity className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm text-gray-400">Active Markets</div>
                              <div className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                                {activeProjects}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-cyan-400 text-sm font-medium">Live</div>
                            <div className="text-xs text-gray-400">voting now</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                              <Rocket className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm text-gray-400">Total Launched</div>
                              <div className="text-xl font-bold text-white group-hover:text-green-300 transition-colors">
                                {launchedProjects.length}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-400 text-sm font-medium">Success</div>
                            <div className="text-xs text-gray-400">projects</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                              <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm text-gray-400">Total Pool Volume</div>
                              <div className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                                {(Number(totalVolume) || 0).toFixed(1)} SOL
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-purple-400 text-sm font-medium">Locked</div>
                            <div className="text-xs text-gray-400">in markets</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm text-gray-400">Total Votes</div>
                              <div className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                                {totalVotes.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-blue-400 text-sm font-medium">Active</div>
                            <div className="text-xs text-gray-400">community</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Platform Activity</span>
                        <span className={`font-medium ${activeProjects > 5 ? 'text-green-400' : activeProjects > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {activeProjects > 5 ? 'High' : activeProjects > 0 ? 'Moderate' : 'Low'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((activeProjects / 10) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Container 3: Launched Projects */}
          <div className="space-y-4">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Award className="w-5 h-5 text-yellow-400" />
                  <span>Launched Projects</span>
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Successfully launched tokens and their performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingLaunched ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                    <span className="ml-3 text-white">Loading launched projects...</span>
                  </div>
                ) : launchedProjects.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/70 text-sm">No launched projects yet</p>
                  </div>
                ) : (
                  <>
                    {launchedProjects.slice(0, 4).map((project) => (
                      <Link href={`/market/${project.id}`} key={project.id} prefetch={true}>
                        <div className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-102 group cursor-pointer">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold text-white group-hover:text-yellow-300 transition-colors">
                                  {project.name}
                                </h3>
                                <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs">
                                  {project.symbol}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-400">Launched: {formatLaunchDate(project.launchDate)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-gray-400 text-xs">YES Support</div>
                              <div className="font-semibold text-green-400">{(Number(project.yesPercentage) || 0).toFixed(1)}%</div>
                            </div>
                            <div className="text-right">
                              <div className="text-gray-400 text-xs">Launch Pool</div>
                              <div className="font-semibold text-white">{project.launchPool}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs">Total Votes</div>
                              <div className="font-semibold text-white">{project.totalVotes}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-gray-400 text-xs">Category</div>
                              <div className="font-semibold text-white">{formatLabel(project.category)}</div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </>
                )}

                <Button asChild variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 hover:border-white/30">
                  <Link href="/launched" prefetch={true}>
                    <Rocket className="w-4 h-4 mr-2" />
                    View All Launched
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Action at Bottom */}
        <div className="mt-8">
          <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl border-purple-500/20 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">Ready to Launch Your Project?</h2>
                  <p className="text-white/70">Create a prediction market and let the community decide your token&apos;s future</p>
                </div>
                <Button asChild size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-purple-500/40">
                  <Link href="/create" prefetch={true}>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Project
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}