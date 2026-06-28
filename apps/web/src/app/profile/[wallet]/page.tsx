'use client';

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
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
  FileText,
} from 'lucide-react';
import useSWR from 'swr';
import Link from 'next/link';
import { useUserSocket } from '@/lib/hooks/useSocket';
import { ResearchPaperCard } from '@/components/research/ResearchPaperCard';
import { OrcidBadge } from '@/components/research/OrcidBadge';
import { OrcidConnect } from '@/components/profile/OrcidConnect';
import { GithubConnect } from '@/components/profile/GithubConnect';
import { LinkedTerminals } from '@/components/profile/LinkedTerminals';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PublicProfilePage() {
  // useParams() is typed as `T | null` but this route is /profile/[wallet]
  // so the segment is always present at runtime.
  const params = useParams<{ wallet: string }>()!;
  const profileWallet = params.wallet;
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

  // Research papers authored by this wallet. The author endpoint 404s with
  // { success:false } when there are none — rendered as "no section" below.
  const { data: papersData } = useSWR(
    profileWallet ? `/api/research/author/${profileWallet}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const authoredPapers = papersData?.success ? (papersData.data?.papers ?? []) : [];

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
        const response = await authFetch(`/api/profile/${profileWallet}/follow?followerWallet=${viewerWallet}`, {
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
        const response = await authFetch(`/api/profile/${profileWallet}/follow`, {
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
          <RefreshCw className="w-8 h-8 text-cream animate-spin mx-auto mb-3" />
          <p className="text-cream-dim">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-earth mb-4">Failed to load profile</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="border-hair-strong text-cream">
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
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-ember flex items-center justify-center overflow-hidden ring-4 ring-[rgba(244,238,228,0.18)] mx-auto mb-4">
            {profile?.profilePhotoUrl ? (
              <img src={profile.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 sm:w-16 sm:h-16 text-cream" />
            )}
          </div>

          {/* Username + verified-researcher badge */}
          <h1 className="text-2xl sm:text-3xl font-bold text-cream mb-2 inline-flex items-center gap-2 justify-center">
            {profile?.username || 'Anonymous User'}
            {profile?.orcidId && <OrcidBadge orcidId={profile.orcidId} size={20} />}
          </h1>

          {/* Own-profile: verify ORCID + connect GitHub */}
          {isOwnProfile && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <OrcidConnect />
              <GithubConnect />
            </div>
          )}

          {/* Bio */}
          {profile?.bio && (
            <p className="text-cream-dim text-sm sm:text-base mb-2 max-w-2xl mx-auto">
              {profile.bio}
            </p>
          )}

          {/* Twitter Handle */}
          {profile?.twitter && (
            <a
              href={`https://x.com/${profile.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ember hover:text-ember transition-colors text-sm mb-3"
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
            className="text-xs text-cream-faint hover:text-ember transition-colors cursor-pointer inline-flex items-center gap-1 break-all max-w-full px-2"
          >
            <span className="truncate">
              {profileWallet.slice(0, 8)}...{profileWallet.slice(-6)}
            </span>
            {addressCopied ? (
              <Check className="w-3 h-3 text-signal-green flex-shrink-0" />
            ) : (
              <Copy className="w-3 h-3 flex-shrink-0" />
            )}
          </button>
          {addressCopied && (
            <p className="text-xs text-signal-green mt-1">Copied!</p>
          )}

          {/* Real-time Status Indicator */}
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-signal-green animate-pulse' : 'bg-[rgba(244,238,228,0.16)]'}`}></div>
            <span className="text-xs text-cream-dim">
              {socketConnected ? 'Live updates' : 'Polling mode'}
            </span>
          </div>
        </div>

        {/* Stats & Follow/View Wallet Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href={`/profile/${profileWallet}/followers`} className="text-center hover:opacity-80 transition-opacity">
              <div className="text-2xl font-bold text-cream">{followerCount}</div>
              <div className="text-xs text-cream-dim">Followers</div>
            </Link>
            <Link href={`/profile/${profileWallet}/following`} className="text-center hover:opacity-80 transition-opacity">
              <div className="text-2xl font-bold text-cream">{followingCount}</div>
              <div className="text-xs text-cream-dim">Following</div>
            </Link>
            <div className="text-center">
              <div className="text-2xl font-bold text-cream">{profile?.totalPredictions || 0}</div>
              <div className="text-xs text-cream-dim">Predictions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cream">{profile?.projectsCreated || 0}</div>
              <div className="text-xs text-cream-dim">Projects</div>
            </div>
          </div>

          {/* Follow Button - Only show if not own profile */}
          {!isOwnProfile && viewerWallet && (
            <Button
              onClick={handleFollowToggle}
              disabled={isFollowLoading}
              className={`${
                isFollowing
                  ? 'bg-[rgba(244,238,228,0.06)] hover:bg-[rgba(244,238,228,0.08)] text-cream border border-hair-strong'
                  : 'bg-ember hover:bg-peach text-cosmic'
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
            <Button asChild variant="outline" className="border-hair-strong text-cream hover:bg-[rgba(244,238,228,0.06)]">
              <Link href="/wallet">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Wallet
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Own-profile: terminals linked via device authorization, revocable. */}
      {isOwnProfile && <LinkedTerminals />}

      {/* Content Sections */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Your Predictions Section */}
        <div className="space-y-4">
          <h3 className="text-lg sm:text-xl font-semibold text-cream px-2 sm:px-0">Predictions</h3>

          {positionsLoading ? (
            <Card className="bg-[rgba(244,238,228,0.03)] border-hair-strong">
              <CardContent className="p-6">
                <div className="text-center text-cream-dim py-8">
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
                    <h4 className="text-sm font-medium text-cream-dim">Active Positions</h4>
                    {positionsData.data.active.length > 3 && (
                      <button
                        onClick={() => setShowAllPositions(!showAllPositions)}
                        className="text-xs text-ember hover:text-ember transition-colors"
                      >
                        {showAllPositions ? 'View Less' : `View All (${positionsData.data.active.length})`}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.active.slice(0, showAllPositions ? undefined : 3).map((position: any) => (
                      <Card key={position.marketId} className="bg-[rgba(244,238,228,0.03)] border-hair-strong hover:bg-[rgba(244,238,228,0.06)] transition-colors">
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
                                  <div className={`w-10 h-10 ${
                                    position.voteType === 'yes' ? 'bg-forest' : 'bg-earth'
                                  } rounded-lg flex items-center justify-center flex-shrink-0`}>
                                    <TrendingUp className="w-5 h-5 text-cream" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-cream font-semibold group-hover:text-ember transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-cream-dim">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs border whitespace-nowrap ${
                                position.voteType === 'yes'
                                  ? 'bg-[rgba(95,191,143,0.16)] text-signal-green border-[rgba(95,191,143,0.3)]'
                                  : 'bg-[rgba(207,122,111,0.16)] text-earth border-[rgba(207,122,111,0.3)]'
                              }`}>
                                {position.voteType.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-[rgba(244,238,228,0.03)] rounded p-2 border border-hair-strong">
                                <div className="text-cream-dim text-xs">Stake</div>
                                <div className="font-semibold text-cream">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-cream-faint">
                                  {position.tradeCount} {position.tradeCount === 1 ? 'trade' : 'trades'}
                                </div>
                              </div>
                              <div className="bg-[rgba(244,238,228,0.03)] rounded p-2 border border-hair-strong">
                                <div className="text-cream-dim text-xs">Current Price</div>
                                <div className={`font-semibold ${
                                  position.voteType === 'yes' ? 'text-signal-green' : 'text-earth'
                                }`}>
                                  {position.voteType === 'yes' ? (Number(position.currentYesPrice) || 0).toFixed(1) : (Number(position.currentNoPrice) || 0).toFixed(1)}%
                                </div>
                                <div className="text-xs text-cream-faint">
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
                  <h4 className="text-sm font-medium text-cream-dim">Claimable Rewards</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.claimable.map((position: any) => (
                      <Card key={position.marketId} className="bg-[rgba(95,191,143,0.08)] border-[rgba(95,191,143,0.2)] hover:border-[rgba(95,191,143,0.4)] transition-colors">
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
                                  <div className="w-10 h-10 bg-forest rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-5 h-5 text-cream" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-cream font-semibold group-hover:text-ember transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-cream-dim">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <span className="px-2 py-1 rounded text-xs border bg-[rgba(95,191,143,0.16)] text-signal-green border-[rgba(95,191,143,0.3)] whitespace-nowrap">
                                WON
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-[rgba(244,238,228,0.03)] rounded p-2 border border-hair-strong">
                                <div className="text-cream-dim text-xs">Stake</div>
                                <div className="font-semibold text-cream">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-cream-faint">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-[rgba(244,238,228,0.03)] rounded p-2 border border-hair-strong">
                                <div className="text-cream-dim text-xs">Resolution</div>
                                <div className="font-semibold text-signal-green">
                                  {position.resolution || 'YesWins'}
                                </div>
                                <div className="text-xs text-cream-faint">
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
                  <h4 className="text-sm font-medium text-cream-dim">Resolved Positions</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.resolved.filter((p: any) => !p.canClaim).map((position: any) => (
                      <Card key={position.marketId} className="bg-[rgba(244,238,228,0.03)] border-hair-strong opacity-70 hover:opacity-100 transition-opacity">
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
                                  <div className="w-10 h-10 bg-[rgba(244,238,228,0.06)] rounded-lg flex items-center justify-center flex-shrink-0">
                                    <XCircle className="w-5 h-5 text-cream" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-cream font-semibold group-hover:text-ember transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-cream-dim">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <span className="px-2 py-1 rounded text-xs border bg-[rgba(207,122,111,0.16)] text-earth border-[rgba(207,122,111,0.3)] whitespace-nowrap">
                                LOST
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-[rgba(244,238,228,0.03)] rounded p-2 border border-hair-strong">
                                <div className="text-cream-dim text-xs">Stake</div>
                                <div className="font-semibold text-cream">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-cream-faint">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-[rgba(244,238,228,0.03)] rounded p-2 border border-hair-strong">
                                <div className="text-cream-dim text-xs">Resolution</div>
                                <div className="font-semibold text-earth">
                                  {position.resolution || 'NoWins'}
                                </div>
                                <div className="text-xs text-cream-faint">
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
            <Card className="bg-[rgba(244,238,228,0.03)] border-hair-strong">
              <CardContent className="p-6">
                <div className="text-center text-cream-dim py-8">
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
              <Rocket className="w-5 h-5 text-ember" />
              <h3 className="text-lg sm:text-xl font-semibold text-cream">Projects Created</h3>
            </div>
            {projectsData?.success && projectsData.data?.projects?.length > 3 && (
              <button
                onClick={() => setShowAllProjects(!showAllProjects)}
                className="text-sm text-ember hover:text-ember transition-colors"
              >
                {showAllProjects ? 'View Less' : `View All (${projectsData.data.projects.length})`}
              </button>
            )}
          </div>

          {projectsLoading ? (
            <Card className="bg-[rgba(244,238,228,0.03)] border-hair-strong">
              <CardContent className="p-6">
                <div className="text-center text-cream-dim py-8">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Loading projects...</p>
                </div>
              </CardContent>
            </Card>
          ) : projectsData?.success && projectsData.data?.projects?.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {projectsData.data.projects.slice(0, showAllProjects ? undefined : 3).map((project: any) => (
                <Card key={project.id} className="bg-[rgba(244,238,228,0.03)] border-hair-strong hover:bg-[rgba(244,238,228,0.06)] transition-colors">
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
                            <div className="w-10 h-10 bg-ember rounded-lg flex items-center justify-center flex-shrink-0">
                              <Rocket className="w-5 h-5 text-cream" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-cream font-semibold group-hover:text-ember transition-colors truncate">
                              {project.name}
                            </h4>
                            <p className="text-xs text-cream-dim">{project.tokenSymbol}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs border whitespace-nowrap ${
                          project.status === 'Launched'
                            ? 'bg-[rgba(95,191,143,0.16)] text-signal-green border-[rgba(95,191,143,0.3)]'
                            : project.status === 'Not Launched'
                            ? 'bg-[rgba(207,122,111,0.16)] text-earth border-[rgba(207,122,111,0.3)]'
                            : project.status === 'Pending Resolution'
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-400/30'
                            : 'bg-blue-500/20 text-blue-400 border-blue-400/30'
                        }`}>
                          {project.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-[rgba(244,238,228,0.03)] rounded p-2 border border-hair-strong">
                          <div className="text-cream-dim text-xs">Pool Progress</div>
                          <div className="font-semibold text-cream">
                            {(project.poolProgressPercentage || 0).toFixed(0)}%
                          </div>
                          <div className="text-xs text-cream-faint">
                            {(project.poolBalance || 0).toFixed(2)} / {(project.targetPool || 0).toFixed(0)} SOL
                          </div>
                        </div>
                        <div className="bg-[rgba(244,238,228,0.03)] rounded p-2 border border-hair-strong">
                          <div className="text-cream-dim text-xs">YES Rate</div>
                          <div className="font-semibold text-signal-green">
                            {(project.sharesYesPercentage || 0).toFixed(1)}%
                          </div>
                          <div className="text-xs text-cream-faint">
                            {(project.yesVoteCount || 0) + (project.noVoteCount || 0)} votes
                          </div>
                        </div>
                      </div>

                      {project.status === 'Active' && !project.isExpired && (
                        <div className="mt-3 text-xs text-cream-dim">
                          <span className="text-cream font-medium">{project.timeLeft}</span> remaining
                        </div>
                      )}
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-[rgba(244,238,228,0.03)] border-hair-strong">
              <CardContent className="p-6">
                <div className="text-center text-cream-dim py-8">
                  <Rocket className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No projects created yet</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Research Section — only shown when this wallet has published papers */}
        {authoredPapers.length > 0 && (
          <div className="space-y-4 mt-8">
            <div className="flex items-center space-x-2 px-2 sm:px-0">
              <FileText className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg sm:text-xl font-semibold text-cream">Research</h3>
              <span className="text-sm text-cream-dim">({authoredPapers.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {authoredPapers.map((p: any) => (
                <ResearchPaperCard
                  key={p.id}
                  paper={{
                    id: p.id,
                    title: p.title,
                    summary: p.summary,
                    likeCount: p.likeCount,
                    dislikeCount: p.dislikeCount,
                    createdAt: p.createdAt,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
