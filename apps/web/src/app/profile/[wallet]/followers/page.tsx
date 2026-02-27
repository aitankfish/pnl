'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  ArrowLeft,
  RefreshCw,
  UserPlus,
  UserMinus,
  Users,
} from 'lucide-react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface FollowerProfile {
  walletAddress: string;
  username: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
  reputationScore: number;
  followerCount: number;
  followingCount: number;
  followedAt: Date;
}

export default function FollowersPage() {
  const params = useParams();
  const router = useRouter();
  const profileWallet = params?.wallet as string;
  const { primaryWallet } = useWallet();
  const viewerWallet = primaryWallet?.address;

  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Fetch followers list
  const { data: followersData, error, isLoading, mutate } = useSWR(
    profileWallet ? `/api/profile/${profileWallet}/followers` : null,
    fetcher
  );

  const followers = followersData?.data?.followers || [];

  // Handle follow/unfollow
  const handleFollowToggle = async (targetWallet: string) => {
    if (!viewerWallet) {
      alert('Please connect your wallet to follow users');
      return;
    }

    if (targetWallet === viewerWallet) {
      alert('You cannot follow yourself');
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [targetWallet]: true }));

    try {
      const isCurrentlyFollowing = followingStates[targetWallet];

      if (isCurrentlyFollowing) {
        // Unfollow
        const response = await fetch(`/api/profile/${targetWallet}/follow?followerWallet=${viewerWallet}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (data.success) {
          setFollowingStates((prev) => ({ ...prev, [targetWallet]: false }));
        } else {
          alert(data.error || 'Failed to unfollow');
        }
      } else {
        // Follow
        const response = await fetch(`/api/profile/${targetWallet}/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerWallet: viewerWallet }),
        });

        const data = await response.json();
        if (data.success) {
          setFollowingStates((prev) => ({ ...prev, [targetWallet]: true }));
        } else {
          alert(data.error || 'Failed to follow');
        }
      }
    } catch (error) {
      console.error('Follow toggle error:', error);
      alert('Failed to update follow status');
    } finally {
      setLoadingStates((prev) => ({ ...prev, [targetWallet]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-white animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading followers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load followers</p>
          <Button onClick={() => mutate()} variant="outline" className="border-white/20 text-white">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Followers</h1>
            <p className="text-gray-400 text-sm">
              {followersData?.data?.total || 0} {followersData?.data?.total === 1 ? 'follower' : 'followers'}
            </p>
          </div>
        </div>

        {/* Followers List */}
        {followers.length > 0 ? (
          <div className="space-y-3">
            {followers.map((follower: FollowerProfile) => {
              const isOwnProfile = viewerWallet === follower.walletAddress;
              const isFollowing = followingStates[follower.walletAddress];
              const isLoading = loadingStates[follower.walletAddress];

              return (
                <Card key={follower.walletAddress} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Profile Photo */}
                      <Link href={`/profile/${follower.walletAddress}`}>
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden ring-2 ring-white/20 flex-shrink-0 cursor-pointer hover:ring-white/40 transition-all">
                          {follower.profilePhotoUrl ? (
                            <img src={follower.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                          )}
                        </div>
                      </Link>

                      {/* Profile Info */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${follower.walletAddress}`}>
                          <h3 className="text-white font-semibold mb-1 hover:text-cyan-400 transition-colors">
                            {follower.username || 'Anonymous User'}
                          </h3>
                        </Link>

                        {follower.bio && (
                          <p className="text-gray-400 text-sm mb-2 line-clamp-2">{follower.bio}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>{follower.followerCount} followers</span>
                          <span>{follower.followingCount} following</span>
                          {follower.reputationScore > 0 && (
                            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-400/30">
                              {follower.reputationScore} Rep
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Follow Button */}
                      {!isOwnProfile && viewerWallet && (
                        <Button
                          onClick={() => handleFollowToggle(follower.walletAddress)}
                          disabled={isLoading}
                          size="sm"
                          className={`flex-shrink-0 ${
                            isFollowing
                              ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                          }`}
                        >
                          {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : isFollowing ? (
                            <>
                              <UserMinus className="w-4 h-4 mr-1" />
                              Unfollow
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-1" />
                              Follow
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              <div className="text-center text-gray-400 py-8">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                <p className="text-sm">No followers yet</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
