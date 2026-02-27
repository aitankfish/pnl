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
  UserMinus,
  Users,
} from 'lucide-react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface FollowingProfile {
  walletAddress: string;
  username: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
  reputationScore: number;
  followerCount: number;
  followingCount: number;
  followedAt: Date;
}

export default function FollowingPage() {
  const params = useParams();
  const router = useRouter();
  const profileWallet = params?.wallet as string;
  const { primaryWallet } = useWallet();
  const viewerWallet = primaryWallet?.address;

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Fetch following list
  const { data: followingData, error, isLoading, mutate } = useSWR(
    profileWallet ? `/api/profile/${profileWallet}/following` : null,
    fetcher
  );

  const following = followingData?.data?.following || [];
  const isOwnProfile = viewerWallet === profileWallet;

  // Handle unfollow
  const handleUnfollow = async (targetWallet: string) => {
    if (!viewerWallet) {
      alert('Please connect your wallet');
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [targetWallet]: true }));

    try {
      const response = await fetch(`/api/profile/${targetWallet}/follow?followerWallet=${viewerWallet}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        // Refresh the list
        mutate();
      } else {
        alert(data.error || 'Failed to unfollow');
      }
    } catch (error) {
      console.error('Unfollow error:', error);
      alert('Failed to unfollow user');
    } finally {
      setLoadingStates((prev) => ({ ...prev, [targetWallet]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-white animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading following...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load following</p>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Following</h1>
            <p className="text-gray-400 text-sm">
              {followingData?.data?.total || 0} {followingData?.data?.total === 1 ? 'user' : 'users'}
            </p>
          </div>
        </div>

        {/* Following List */}
        {following.length > 0 ? (
          <div className="space-y-3">
            {following.map((user: FollowingProfile) => {
              const isLoading = loadingStates[user.walletAddress];
              const showUnfollowButton = isOwnProfile && viewerWallet;

              return (
                <Card key={user.walletAddress} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Profile Photo */}
                      <Link href={`/profile/${user.walletAddress}`}>
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden ring-2 ring-white/20 flex-shrink-0 cursor-pointer hover:ring-white/40 transition-all">
                          {user.profilePhotoUrl ? (
                            <img src={user.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                          )}
                        </div>
                      </Link>

                      {/* Profile Info */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${user.walletAddress}`}>
                          <h3 className="text-white font-semibold mb-1 hover:text-cyan-400 transition-colors">
                            {user.username || 'Anonymous User'}
                          </h3>
                        </Link>

                        {user.bio && (
                          <p className="text-gray-400 text-sm mb-2 line-clamp-2">{user.bio}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>{user.followerCount} followers</span>
                          <span>{user.followingCount} following</span>
                          {user.reputationScore > 0 && (
                            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-400/30">
                              {user.reputationScore} Rep
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Unfollow Button (only on own profile) */}
                      {showUnfollowButton && (
                        <Button
                          onClick={() => handleUnfollow(user.walletAddress)}
                          disabled={isLoading}
                          size="sm"
                          className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                        >
                          {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <UserMinus className="w-4 h-4 mr-1" />
                              Unfollow
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
                <p className="text-sm">Not following anyone yet</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
