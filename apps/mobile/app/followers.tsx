/**
 * Followers/Following list screen
 * Route: /followers?type=followers|following&wallet=...
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/providers/AuthProvider';
import { useFollowers, useFollowing, useToggleFollow, type FollowUser } from '../src/hooks/useFollow';
import { resolveAvatarUrl } from '../src/hooks/useProfile';
import { AvatarImage } from '../src/components';
import { ScreenHeader, PressableScale } from '../src/components';
import { colors, spacing, borderRadius, typography } from '../src/theme';

export default function FollowersScreen() {
  const { type = 'followers', wallet } = useLocalSearchParams<{ type: string; wallet: string }>();
  const { walletAddress: myWallet } = useAuth();

  const isFollowersView = type === 'followers';
  const { followers, isLoading: followersLoading, refresh: refreshFollowers } = useFollowers(
    isFollowersView ? wallet ?? null : null,
  );
  const { following, isLoading: followingLoading, refresh: refreshFollowing } = useFollowing(
    !isFollowersView ? wallet ?? null : null,
  );

  const users = isFollowersView ? followers : following;
  const isLoading = isFollowersView ? followersLoading : followingLoading;

  const { toggleFollow, isToggling } = useToggleFollow(myWallet);

  // Track local follow state
  const [localFollowState, setLocalFollowState] = useState<Record<string, boolean>>({});

  const handleToggle = useCallback(
    async (targetWallet: string, currentlyFollowing: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Optimistic
      setLocalFollowState((prev) => ({ ...prev, [targetWallet]: !currentlyFollowing }));

      const success = await toggleFollow(targetWallet, currentlyFollowing);
      if (!success) {
        // Revert
        setLocalFollowState((prev) => ({ ...prev, [targetWallet]: currentlyFollowing }));
      } else {
        refreshFollowers();
        refreshFollowing();
      }
    },
    [toggleFollow, refreshFollowers, refreshFollowing],
  );

  const renderUser = useCallback(
    ({ item }: { item: FollowUser }) => {
      const avatarUrl = item.profilePhotoUrl
        ? resolveAvatarUrl(item.profilePhotoUrl)
        : null;
      const isMe = item.walletAddress === myWallet;
      // Determine follow state: use local override if exists
      const isFollowing =
        localFollowState[item.walletAddress] ?? false;

      return (
        <View style={styles.userRow}>
          <PressableScale
            onPress={() =>
              router.push(`/profile/${item.walletAddress}`)
            }
            style={styles.userInfo}
          >
            <AvatarImage uri={avatarUrl} size={styles.avatar.width} fallbackIconSize={20} />
            <View style={styles.userText}>
              <Text style={styles.username} numberOfLines={1}>
                {item.username ? `@${item.username}` : truncateAddr(item.walletAddress)}
              </Text>
              {item.bio ? (
                <Text style={styles.bio} numberOfLines={1}>
                  {item.bio}
                </Text>
              ) : null}
              <Text style={styles.reputation}>
                Rep: {item.reputationScore}
              </Text>
            </View>
          </PressableScale>

          {!isMe && myWallet && (
            <PressableScale
              onPress={() => handleToggle(item.walletAddress, isFollowing)}
              disabled={isToggling}
              style={[
                styles.followBtn,
                isFollowing && styles.followingBtn,
              ]}
            >
              <Text
                style={[
                  styles.followBtnText,
                  isFollowing && styles.followingBtnText,
                ]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </PressableScale>
          )}
        </View>
      );
    },
    [myWallet, localFollowState, isToggling, handleToggle],
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isFollowersView ? 'Followers' : 'Following'}
        left={
          <PressableScale onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </PressableScale>
        }
      />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            {isFollowersView ? 'No followers yet' : 'Not following anyone yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.walletAddress}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userText: {
    flex: 1,
  },
  username: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  bio: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: 1,
  },
  reputation: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 1,
  },
  followBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  followBtnText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '600',
  },
  followingBtnText: {
    color: colors.textSecondary,
  },
});
