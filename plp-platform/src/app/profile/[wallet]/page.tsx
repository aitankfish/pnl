'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Copy,
  Check,
  RefreshCw,
  UserPlus,
  UserMinus,
  ExternalLink,
  Rocket,
  TrendingUp,
  Trophy,
  XCircle,
} from 'lucide-react';
import useSWR from 'swr';
import Link from 'next/link';
import { useUserSocket } from '@/lib/hooks/useSocket';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PublicProfilePage() {
  const params = useParams();
  const profileWallet = params.wallet as string;
  const { primaryWallet } = useWallet();
  const viewerWallet = primaryWallet?.address;

  const [addressCopied, setAddressCopied] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // View more states for collapsible sections
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Fetch profile data
  const { data: profileData, error: profileError, isLoading: profileLoading, mutate: mutateProfile } = useSWR(
    profileWallet ? `/api/profile/${profileWallet}` : null,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds to keep stats accurate
  );

  // Fetch positions
  const { data: positionsData, isLoading: positionsLoading, mutate: mutatePositions } = useSWR(
    profileWallet ? `/api/user/${profileWallet}/positions` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch projects
  const { data: projectsData, isLoading: projectsLoading, mutate: mutateProjects } = useSWR(
    profileWallet ? `/api/user/${profileWallet}/projects` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch follow status
  const { data: followStatusData, mutate: mutateFollowStatus } = useSWR(
    profileWallet && viewerWallet ? `/api/profile/${profileWallet}/follow-status?viewer=${viewerWallet}` : null,
    fetcher,
    {
      onSuccess: (data) => {
        if (data?.success) {
          setIsFollowing(data.data.isFollowing);
        }
      }
    }
  );

  // Real-time Socket.IO updates
  const { positions: realtimePositions, isConnected: socketConnected } = useUserSocket(
    profileWallet || null
  );

  // Real-time position updates - revalidate SWR cache when Socket.IO updates arrive
  useEffect(() => {
    if (realtimePositions && realtimePositions.size > 0) {
      console.log('🔄 Real-time position update received for profile, revalidating...');
      mutatePositions();
      mutateProjects();
      mutateProfile(); // Also update profile stats (prediction count, etc.)
    }
  }, [realtimePositions, mutatePositions, mutateProjects, mutateProfile]);

  const profile = profileData?.data;
  const followerCount = profile?.followerCount || 0;
  const followingCount = profile?.followingCount || 0;
  const isOwnProfile = viewerWallet && profileWallet === viewerWallet;

  // Copy address to clipboard
  const copyAddress = () => {
    navigator.clipboard.writeText(profileWallet);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!viewerWallet) {
      alert('Please connect your wallet to follow users');
      return;
    }

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const response = await fetch(`/api/profile/${profileWallet}/follow?followerWallet=${viewerWallet}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (data.success) {
          setIsFollowing(false);
          mutateProfile();
          mutateFollowStatus();
        } else {
          alert(data.error || 'Failed to unfollow');
        }
      } else {
        // Follow
        const response = await fetch(`/api/profile/${profileWallet}/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerWallet: viewerWallet }),
        });

        const data = await response.json();
        if (data.success) {
          setIsFollowing(true);
          mutateProfile();
          mutateFollowStatus();
        } else {
          alert(data.error || 'Failed to follow');
        }
      }
    } catch (error) {
      console.error('Follow toggle error:', error);
      alert('Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-white animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load profile</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="border-white/20 text-white">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      {/* Profile Header */}
      <div className="max-w-5xl mx-auto mb-6 sm:mb-8">
        <div className="text-center mb-6 px-4">
          {/* Profile Photo */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden ring-4 ring-white/20 mx-auto mb-4">
            {profile?.profilePhotoUrl ? (
              <img src={profile.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
            )}
          </div>

          {/* Username */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {profile?.username || 'Anonymous User'}
          </h1>

          {/* Bio */}
          {profile?.bio && (
            <p className="text-gray-400 text-sm sm:text-base mb-2 max-w-2xl mx-auto">
              {profile.bio}
            </p>
          )}

          {/* Twitter Handle */}
          {profile?.twitter && (
            <a
              href={`https://x.com/${profile.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors text-sm mb-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @{profile.twitter}
            </a>
          )}

          {/* Wallet Address */}
          <button
            onClick={copyAddress}
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors cursor-pointer inline-flex items-center gap-1 break-all max-w-full px-2"
          >
            <span className="truncate">
              {profileWallet.slice(0, 8)}...{profileWallet.slice(-6)}
            </span>
            {addressCopied ? (
              <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
            ) : (
              <Copy className="w-3 h-3 flex-shrink-0" />
            )}
          </button>
          {addressCopied && (
            <p className="text-xs text-green-400 mt-1">Copied!</p>
          )}

          {/* Real-time Status Indicator */}
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-xs text-gray-400">
              {socketConnected ? 'Live updates' : 'Polling mode'}
            </span>
          </div>
        </div>

        {/* Stats & Follow/View Wallet Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href={`/profile/${profileWallet}/followers`} className="text-center hover:opacity-80 transition-opacity">
              <div className="text-2xl font-bold text-white">{followerCount}</div>
              <div className="text-xs text-gray-400">Followers</div>
            </Link>
            <Link href={`/profile/${profileWallet}/following`} className="text-center hover:opacity-80 transition-opacity">
              <div className="text-2xl font-bold text-white">{followingCount}</div>
              <div className="text-xs text-gray-400">Following</div>
            </Link>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{profile?.totalPredictions || 0}</div>
              <div className="text-xs text-gray-400">Predictions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{profile?.projectsCreated || 0}</div>
              <div className="text-xs text-gray-400">Projects</div>
            </div>
          </div>

          {/* Follow Button - Only show if not own profile */}
          {!isOwnProfile && viewerWallet && (
            <Button
              onClick={handleFollowToggle}
              disabled={isFollowLoading}
              className={`${
                isFollowing
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
              }`}
            >
              {isFollowLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : isFollowing ? (
                <UserMinus className="w-4 h-4 mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {isFollowing ? 'Unfollow' : 'Follow'}
            </Button>
          )}

          {/* View Own Wallet Button */}
          {isOwnProfile && (
            <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <Link href="/wallet">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Wallet
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Content Sections */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Your Predictions Section */}
        <div className="space-y-4">
          <h3 className="text-lg sm:text-xl font-semibold text-white px-2 sm:px-0">Predictions</h3>

          {positionsLoading ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Loading predictions...</p>
                </div>
              </CardContent>
            </Card>
          ) : positionsData?.success && positionsData.data?.all?.length > 0 ? (
            <>
              {/* Active Positions */}
              {positionsData.data.active.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-400">Active Positions</h4>
                    {positionsData.data.active.length > 3 && (
                      <button
                        onClick={() => setShowAllPositions(!showAllPositions)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        {showAllPositions ? 'View Less' : `View All (${positionsData.data.active.length})`}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.active.slice(0, showAllPositions ? undefined : 3).map((position: any) => (
                      <Card key={position.marketId} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                        <CardContent className="p-4">
                          <a href={`/market/${position.marketId}`} className="block group">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                {position.marketImage ? (
                                  <img
                                    src={position.marketImage}
                                    alt={position.marketName}
                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className={`w-10 h-10 bg-gradient-to-r ${
                                    position.voteType === 'yes'
                                      ? 'from-green-500 to-emerald-500'
                                      : 'from-red-500 to-pink-500'
                                  } rounded-lg flex items-center justify-center flex-shrink-0`}>
                                    <TrendingUp className="w-5 h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs border whitespace-nowrap ${
                                position.voteType === 'yes'
                                  ? 'bg-green-500/20 text-green-400 border-green-400/30'
                                  : 'bg-red-500/20 text-red-400 border-red-400/30'
                              }`}>
                                {position.voteType.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Stake</div>
                                <div className="font-semibold text-white">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.tradeCount} {position.tradeCount === 1 ? 'trade' : 'trades'}
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Current Price</div>
                                <div className={`font-semibold ${
                                  position.voteType === 'yes' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {position.voteType === 'yes' ? (Number(position.currentYesPrice) || 0).toFixed(1) : (Number(position.currentNoPrice) || 0).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType === 'yes' ? 'YES' : 'NO'} rate
                                </div>
                              </div>
                            </div>
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Claimable Positions */}
              {positionsData.data.claimable.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h4 className="text-sm font-medium text-gray-400">Claimable Rewards</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.claimable.map((position: any) => (
                      <Card key={position.marketId} className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/40 transition-colors">
                        <CardContent className="p-4">
                          <a href={`/market/${position.marketId}`} className="block group">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                {position.marketImage ? (
                                  <img
                                    src={position.marketImage}
                                    alt={position.marketName}
                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-5 h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <span className="px-2 py-1 rounded text-xs border bg-green-500/20 text-green-400 border-green-400/30 whitespace-nowrap">
                                WON
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Stake</div>
                                <div className="font-semibold text-white">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Resolution</div>
                                <div className="font-semibold text-green-400">
                                  {position.resolution || 'YesWins'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Won!
                                </div>
                              </div>
                            </div>
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolved but not claimable positions */}
              {positionsData.data.resolved.filter((p: any) => !p.canClaim).length > 0 && (
                <div className="space-y-3 mt-6">
                  <h4 className="text-sm font-medium text-gray-400">Resolved Positions</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.resolved.filter((p: any) => !p.canClaim).map((position: any) => (
                      <Card key={position.marketId} className="bg-white/5 border-white/10 opacity-70 hover:opacity-100 transition-opacity">
                        <CardContent className="p-4">
                          <a href={`/market/${position.marketId}`} className="block group">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                {position.marketImage ? (
                                  <img
                                    src={position.marketImage}
                                    alt={position.marketName}
                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 grayscale"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <XCircle className="w-5 h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <span className="px-2 py-1 rounded text-xs border bg-red-500/20 text-red-400 border-red-400/30 whitespace-nowrap">
                                LOST
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Stake</div>
                                <div className="font-semibold text-white">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Resolution</div>
                                <div className="font-semibold text-red-400">
                                  {position.resolution || 'NoWins'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  No rewards
                                </div>
                              </div>
                            </div>
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm">No predictions yet</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Projects Created Section */}
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between px-2 sm:px-0">
            <div className="flex items-center space-x-2">
              <Rocket className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg sm:text-xl font-semibold text-white">Projects Created</h3>
            </div>
            {projectsData?.success && projectsData.data?.projects?.length > 3 && (
              <button
                onClick={() => setShowAllProjects(!showAllProjects)}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {showAllProjects ? 'View Less' : `View All (${projectsData.data.projects.length})`}
              </button>
            )}
          </div>

          {projectsLoading ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Loading projects...</p>
                </div>
              </CardContent>
            </Card>
          ) : projectsData?.success && projectsData.data?.projects?.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {projectsData.data.projects.slice(0, showAllProjects ? undefined : 3).map((project: any) => (
                <Card key={project.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                  <CardContent className="p-4">
                    <a href={`/market/${project.id}`} className="block group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {project.projectImageUrl ? (
                            <img
                              src={project.projectImageUrl}
                              alt={project.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Rocket className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
                              {project.name}
                            </h4>
                            <p className="text-xs text-gray-400">{project.tokenSymbol}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs border whitespace-nowrap ${
                          project.status === 'Launched'
                            ? 'bg-green-500/20 text-green-400 border-green-400/30'
                            : project.status === 'Not Launched'
                            ? 'bg-red-500/20 text-red-400 border-red-400/30'
                            : project.status === 'Pending Resolution'
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-400/30'
                            : 'bg-blue-500/20 text-blue-400 border-blue-400/30'
                        }`}>
                          {project.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-white/5 rounded p-2 border border-white/10">
                          <div className="text-gray-400 text-xs">Pool Progress</div>
                          <div className="font-semibold text-white">
                            {(project.poolProgressPercentage || 0).toFixed(0)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {(project.poolBalance || 0).toFixed(2)} / {(project.targetPool || 0).toFixed(0)} SOL
                          </div>
                        </div>
                        <div className="bg-white/5 rounded p-2 border border-white/10">
                          <div className="text-gray-400 text-xs">YES Rate</div>
                          <div className="font-semibold text-green-400">
                            {(project.sharesYesPercentage || 0).toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {(project.yesVoteCount || 0) + (project.noVoteCount || 0)} votes
                          </div>
                        </div>
                      </div>

                      {project.status === 'Active' && !project.isExpired && (
                        <div className="mt-3 text-xs text-gray-400">
                          <span className="text-white font-medium">{project.timeLeft}</span> remaining
                        </div>
                      )}
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <Rocket className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No projects created yet</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
