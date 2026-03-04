/**
 * Public Profile Screen — View another user's profile by wallet address
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToggleFollow } from '../../src/hooks/useFollow';
import {
  ScreenHeader,
  PressableScale,
  GlassCard,
  EmptyState,
} from '../../src/components';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

interface ProfileData {
  walletAddress: string;
  username: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
  twitter: string | null;
  followerCount: number;
  followingCount: number;
  totalPredictions: number;
  projectsCreated: number;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function PublicProfileScreen() {
  const { wallet } = useLocalSearchParams<{ wallet: string }>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, walletAddress: myWallet } = useAuth();
  const { toggleFollow, isToggling } = useToggleFollow(myWallet);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  const isOwnProfile = myWallet && wallet && myWallet === wallet;

  // Fetch profile
  useEffect(() => {
    if (!wallet) return;
    let mounted = true;

    const fetchProfile = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const res = await fetch(apiUrl(`/api/profile/${wallet}`));
        const data = await res.json();
        if (mounted && data.success) {
          setProfile(data.data);
          setFollowerCount(data.data.followerCount ?? 0);
        } else if (mounted) {
          setError(true);
        }
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchProfile();
    return () => { mounted = false; };
  }, [wallet]);

  // Fetch follow status
  useEffect(() => {
    if (!wallet || !myWallet || wallet === myWallet) return;
    let mounted = true;

    const checkFollowStatus = async () => {
      try {
        const res = await fetch(apiUrl(`/api/profile/${wallet}/follow-status?viewer=${myWallet}`));
        const data = await res.json();
        if (mounted && data.success) {
          setIsFollowing(data.data.isFollowing);
        }
      } catch {
        // ignore
      }
    };

    checkFollowStatus();
    return () => { mounted = false; };
  }, [wallet, myWallet]);

  const handleCopyAddress = useCallback(async () => {
    if (!wallet) return;
    await Clipboard.setStringAsync(wallet);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [wallet]);

  const handleToggleFollow = useCallback(async () => {
    if (!wallet) return;
    const success = await toggleFollow(wallet, isFollowing);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsFollowing(!isFollowing);
      setFollowerCount((c) => isFollowing ? c - 1 : c + 1);
    }
  }, [wallet, isFollowing, toggleFollow]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ScreenHeader
          left={
            <PressableScale onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </PressableScale>
          }
        />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <ScreenHeader
          left={
            <PressableScale onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </PressableScale>
          }
        />
        <EmptyState
          icon="person-outline"
          title="Profile not found"
          subtitle="This user may not exist"
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        left={
          <PressableScale onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </PressableScale>
        }
        title={profile.username || 'Profile'}
      />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        {/* Avatar + name */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profile.profilePhotoUrl ? (
              <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#8b5cf6', '#06b6d4']}
                style={styles.avatar}
              >
                <Ionicons name="person" size={36} color="#fff" />
              </LinearGradient>
            )}
          </View>

          <Text style={styles.username}>
            {profile.username || 'Anonymous'}
          </Text>

          <PressableScale onPress={handleCopyAddress} style={styles.walletRow}>
            <Text style={styles.walletText}>{truncateAddress(profile.walletAddress)}</Text>
            <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
          </PressableScale>

          {/* Follow button */}
          {isAuthenticated && !isOwnProfile && (
            <PressableScale
              onPress={handleToggleFollow}
              disabled={isToggling}
              style={[styles.followBtn, isFollowing && styles.followBtnFollowing]}
            >
              {isToggling ? (
                <ActivityIndicator size={14} color={isFollowing ? colors.textSecondary : '#fff'} />
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? 'checkmark' : 'person-add-outline'}
                    size={16}
                    color={isFollowing ? colors.textSecondary : '#fff'}
                  />
                  <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextFollowing]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </>
              )}
            </PressableScale>
          )}

          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          {profile.twitter ? (
            <View style={styles.twitterRow}>
              <Ionicons name="logo-twitter" size={14} color="#1DA1F2" />
              <Text style={styles.twitterText}>@{profile.twitter}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <PressableScale
            style={{ flex: 1, minWidth: '45%' }}
            onPress={() => router.push({ pathname: '/followers', params: { type: 'followers', wallet: wallet! } })}
          >
            <GlassCard style={styles.statCard}>
              <Text style={styles.statValue}>{followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </GlassCard>
          </PressableScale>
          <PressableScale
            style={{ flex: 1, minWidth: '45%' }}
            onPress={() => router.push({ pathname: '/followers', params: { type: 'following', wallet: wallet! } })}
          >
            <GlassCard style={styles.statCard}>
              <Text style={styles.statValue}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </GlassCard>
          </PressableScale>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{profile.totalPredictions}</Text>
            <Text style={styles.statLabel}>Predictions</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{profile.projectsCreated}</Text>
            <Text style={styles.statLabel}>Projects</Text>
          </GlassCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  username: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  walletText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
    minWidth: 120,
    justifyContent: 'center',
  },
  followBtnFollowing: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  followBtnText: {
    ...typography.captionBold,
    color: '#fff',
  },
  followBtnTextFollowing: {
    color: colors.textSecondary,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  twitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  twitterText: {
    ...typography.caption,
    color: '#1DA1F2',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    ...typography.display,
    color: colors.textPrimary,
    fontSize: 22,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
