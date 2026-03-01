/**
 * Profile Tab — User profile, portfolio, positions, settings
 * Fetches real profile data from API, shows onboarding modal for new users.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../src/providers/AuthProvider';
import { useProfile, resolveAvatarUrl } from '../../src/hooks/useProfile';
import { usePositions } from '../../src/hooks/usePositions';
import {
  ScreenHeader,
  PressableScale,
  GlassCard,
  SectionHeader,
  EmptyState,
} from '../../src/components';
import { ProfileSetupModal } from '../../src/components/ProfileSetupModal';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, walletAddress, logout } = useAuth();
  const {
    profile,
    isLoading: profileLoading,
    needsSetup,
    refresh: refreshProfile,
    updateProfile,
    isUpdating,
    checkUsername,
    generateUsername,
  } = useProfile(walletAddress);

  const {
    active,
    resolved,
    claimable,
    all,
    isLoading: positionsLoading,
  } = usePositions(walletAddress);

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');

  // Show setup modal when profile needs setup
  const shouldShowSetup = isAuthenticated && needsSetup && !profileLoading;

  const handleCopyAddress = useCallback(async () => {
    if (!walletAddress) return;
    await Clipboard.setStringAsync(walletAddress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [walletAddress]);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  }, [logout]);

  const handleEditBio = useCallback(() => {
    setEditBio(profile?.bio || '');
    setIsEditing(true);
  }, [profile?.bio]);

  const handleSaveBio = useCallback(async () => {
    const success = await updateProfile({ bio: editBio.trim() || undefined });
    if (success) {
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [editBio, updateProfile]);

  // Compute portfolio value from active positions
  const totalStaked = useMemo(
    () => all.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    [all],
  );

  const displayName = profile?.username
    ? `@${profile.username}`
    : (user as any)?.email?.address || 'PNL User';

  const avatarUrl = profile?.profilePhotoUrl
    ? resolveAvatarUrl(profile.profilePhotoUrl)
    : null;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Profile"
        right={
          isAuthenticated ? (
            <View style={styles.headerRight}>
              <PressableScale onPress={() => setShowSetupModal(true)}>
                <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
              </PressableScale>
              <PressableScale onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
              </PressableScale>
            </View>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.lg }]}>
        {/* Section 1: User Info */}
        {isAuthenticated ? (
          <View style={styles.userSection}>
            <View style={styles.avatarRing}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={32} color={colors.textMuted} />
                </View>
              )}
            </View>
            <Text style={styles.displayName}>{displayName}</Text>
            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}
            {walletAddress && (
              <PressableScale onPress={handleCopyAddress} style={styles.addressRow}>
                <Text style={styles.address}>{truncateAddress(walletAddress)}</Text>
                <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
              </PressableScale>
            )}

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile?.totalPredictions ?? 0}</Text>
                <Text style={styles.statLabel}>Predictions</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile?.projectsCreated ?? 0}</Text>
                <Text style={styles.statLabel}>Projects</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile?.reputationScore ?? 0}</Text>
                <Text style={styles.statLabel}>Reputation</Text>
              </View>
            </View>

            {/* Bio edit inline */}
            {isEditing && (
              <View style={styles.editBioContainer}>
                <TextInput
                  style={styles.editBioInput}
                  placeholder="Write a bio..."
                  placeholderTextColor={colors.textMuted}
                  value={editBio}
                  onChangeText={setEditBio}
                  multiline
                  maxLength={160}
                  autoFocus
                />
                <View style={styles.editBioActions}>
                  <PressableScale onPress={() => setIsEditing(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </PressableScale>
                  <PressableScale onPress={handleSaveBio} style={styles.saveBioBtn}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveBioText}>Save</Text>
                    )}
                  </PressableScale>
                </View>
              </View>
            )}

            {!isEditing && !profile?.bio && (
              <PressableScale onPress={handleEditBio} style={styles.addBioBtn}>
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.addBioText}>Add bio</Text>
              </PressableScale>
            )}
          </View>
        ) : (
          <View style={styles.signInSection}>
            <Ionicons name="person-circle-outline" size={64} color={colors.textMuted} />
            <Text style={styles.signInTitle}>Sign in to PNL</Text>
            <Text style={styles.signInSubtitle}>
              Track your predictions, portfolio, and earnings
            </Text>
            <PressableScale
              onPress={() => router.push('/login')}
              style={styles.signInButton}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </PressableScale>
          </View>
        )}

        {/* Section 2: Portfolio Summary */}
        {isAuthenticated && (
          <>
            <GlassCard style={styles.portfolioCard}>
              <Text style={styles.portfolioLabel}>Total Staked</Text>
              <Text style={styles.portfolioValue}>
                {totalStaked > 0 ? `${totalStaked.toFixed(2)} SOL` : '0.00 SOL'}
              </Text>
              <View style={styles.positionCounts}>
                <View style={styles.positionCountItem}>
                  <View style={[styles.positionDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.positionCountText}>{active.length} Active</Text>
                </View>
                <View style={styles.positionCountItem}>
                  <View style={[styles.positionDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.positionCountText}>{claimable.length} Claimable</Text>
                </View>
                <View style={styles.positionCountItem}>
                  <View style={[styles.positionDot, { backgroundColor: colors.textMuted }]} />
                  <Text style={styles.positionCountText}>{resolved.length} Resolved</Text>
                </View>
              </View>
            </GlassCard>

            {/* Section 3: Active Positions */}
            <SectionHeader title="Active Positions" count={active.length} />
            {positionsLoading && active.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : active.length > 0 ? (
              active.map((pos) => (
                <PressableScale
                  key={`${pos.marketId}-${pos.voteType}`}
                  onPress={() => router.push(`/market/${pos.marketId}`)}
                  style={styles.positionCard}
                >
                  <View style={styles.positionHeader}>
                    <Text style={styles.positionName} numberOfLines={1}>
                      {pos.marketName}
                    </Text>
                    <View
                      style={[
                        styles.voteBadge,
                        { backgroundColor: pos.voteType === 'yes' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.voteBadgeText,
                          { color: pos.voteType === 'yes' ? colors.success : colors.danger },
                        ]}
                      >
                        {pos.voteType.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.positionDetails}>
                    <Text style={styles.positionDetail}>
                      {pos.totalAmount.toFixed(3)} SOL
                    </Text>
                    <Text style={styles.positionDetailMuted}>
                      {pos.totalShares.toFixed(1)} shares
                    </Text>
                    <Text style={styles.positionDetailMuted}>
                      {((pos.voteType === 'yes' ? pos.currentYesPrice : pos.currentNoPrice) * 100).toFixed(1)}%
                    </Text>
                  </View>
                </PressableScale>
              ))
            ) : (
              <EmptyState
                icon="bar-chart-outline"
                title="No positions yet"
                subtitle="Vote on markets to start building your portfolio"
                actionLabel="Browse Markets"
                onAction={() => router.push('/(tabs)/explore')}
              />
            )}

            {/* Claimable section */}
            {claimable.length > 0 && (
              <>
                <SectionHeader title="Claimable Rewards" count={claimable.length} style={styles.sectionGap} />
                {claimable.map((pos) => (
                  <PressableScale
                    key={`claim-${pos.marketId}-${pos.voteType}`}
                    onPress={() => router.push(`/market/${pos.marketId}`)}
                    style={[styles.positionCard, styles.claimableCard]}
                  >
                    <View style={styles.positionHeader}>
                      <Text style={styles.positionName} numberOfLines={1}>
                        {pos.marketName}
                      </Text>
                      <View style={styles.claimBadge}>
                        <Ionicons name="gift" size={12} color={colors.success} />
                        <Text style={styles.claimBadgeText}>Claim</Text>
                      </View>
                    </View>
                    <Text style={styles.positionDetail}>
                      {pos.totalAmount.toFixed(3)} SOL staked
                    </Text>
                  </PressableScale>
                ))}
              </>
            )}
          </>
        )}

        {/* Section 4: Create */}
        {isAuthenticated && (
          <>
            <SectionHeader title="Create" style={styles.sectionGap} />
            <PressableScale
              onPress={() => {
                // TODO: Navigate to create flow
              }}
              style={styles.createCard}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createGradient}
              >
                <Ionicons name="add-circle" size={32} color="#fff" />
                <Text style={styles.createTitle}>Launch Your Idea</Text>
                <Text style={styles.createSubtitle}>
                  Create a prediction market for any token launch
                </Text>
              </LinearGradient>
            </PressableScale>
          </>
        )}

        {/* Section 5: Settings */}
        <SectionHeader title="Settings" style={styles.sectionGap} />
        <View style={styles.settingsList}>
          {isAuthenticated && (
            <SettingsRow
              icon="create-outline"
              label="Edit Profile"
              onPress={() => setShowSetupModal(true)}
            />
          )}
          <SettingsRow icon="wallet-outline" label="Connected Wallets" />
          <SettingsRow
            icon="document-text-outline"
            label="Whitepaper"
            onPress={() => router.push('/whitepaper')}
          />
          <SettingsRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => router.push('/help')}
          />
        </View>

        {/* Footer links — matches web footer */}
        <View style={styles.footerSection}>
          <Text style={styles.footerTagline}>launch your idea</Text>

          <View style={styles.footerIcons}>
            <FooterIcon
              icon="lock-closed"
              color="#fbbf24"
              label="Terms"
              onPress={() => WebBrowser.openBrowserAsync('https://pnl.market/terms')}
            />
            <FooterIcon
              icon="shield-checkmark"
              color="#34d399"
              label="Privacy"
              onPress={() => WebBrowser.openBrowserAsync('https://pnl.market/privacy')}
            />
            <FooterIcon
              icon="help-circle"
              color="#22d3ee"
              label="How to Buy"
              onPress={() => router.push('/how-to-buy')}
            />
            <FooterIcon
              icon="logo-twitter"
              color="#f9fafb"
              label="X"
              onPress={() => Linking.openURL('https://x.com/pnldotmarket')}
            />
            <FooterIcon
              icon="logo-discord"
              color="#818cf8"
              label="Discord"
              onPress={() => Linking.openURL('https://discord.gg/38pkg4vm')}
            />
          </View>

          <Text style={styles.footerCopy}>© 2025 PNL</Text>
        </View>
      </ScrollView>

      {/* Onboarding / Edit Profile modal */}
      <ProfileSetupModal
        visible={shouldShowSetup || showSetupModal}
        onComplete={() => {
          setShowSetupModal(false);
          refreshProfile();
        }}
        updateProfile={updateProfile}
        generateUsername={generateUsername}
        checkUsername={checkUsername}
        email={(user as any)?.email?.address}
      />
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale style={styles.settingsRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={styles.settingsLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

function FooterIcon({
  icon,
  color,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.footerIconBtn}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.footerIconLabel}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // User section
  userSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    ...typography.title,
    color: colors.textPrimary,
  },
  bio: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  address: {
    ...typography.micro,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.glass,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 18,
  },
  statLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  // Bio editing
  editBioContainer: {
    width: '100%',
    marginTop: spacing.sm,
  },
  editBioInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 60,
  },
  editBioActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  saveBioBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  saveBioText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '600',
  },
  addBioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  addBioText: {
    ...typography.caption,
    color: colors.primary,
  },
  // Sign in section
  signInSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  signInTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  signInSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  signInButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  signInButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },
  // Portfolio
  portfolioCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  portfolioLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  portfolioValue: {
    ...typography.numericLarge,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  positionCounts: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  positionCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  positionCountText: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  // Positions
  positionCard: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  claimableCard: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  positionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  positionName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  voteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  voteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  claimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  claimBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  positionDetails: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  positionDetail: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  positionDetailMuted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  // Create
  sectionGap: {
    marginTop: spacing.md,
  },
  createCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  createGradient: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  createTitle: {
    ...typography.title,
    color: '#fff',
  },
  createSubtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  // Settings
  settingsList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  // Footer
  footerSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  footerTagline: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  footerIcons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  footerIconBtn: {
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
  },
  footerIconLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  footerCopy: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
