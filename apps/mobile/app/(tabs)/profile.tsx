/**
 * Profile Tab — Unified wallet + profile + positions + settings
 * Wallet (balance, actions, tokens) at top, then profile, positions, settings.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
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
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useFundSolanaWallet } from '@privy-io/expo/ui';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { useAllTokenBalances } from '@pnl/shared/hooks';
import { useSolPrice } from '@pnl/shared/hooks';
import { useAuth } from '../../src/providers/AuthProvider';
import { useProfile, resolveAvatarUrl } from '../../src/hooks/useProfile';
import { usePositions } from '../../src/hooks/usePositions';
import { useWalletBalance } from '../../src/hooks/useWalletBalance';
import { useTokenStats } from '../../src/hooks/useTokenStats';
import { useMobileCreatorFees } from '../../src/hooks/useMobileCreatorFees';
import { usePhotoUpload } from '../../src/hooks/usePhotoUpload';
import {
  ScreenHeader,
  PressableScale,
  GlassCard,
  SectionHeader,
  EmptyState,
} from '../../src/components';
import { ProfileSetupModal } from '../../src/components/ProfileSetupModal';
import { PortfolioTabs } from '../../src/components/PortfolioTabs';
import { SendSheet } from '../../src/components/wallet/SendSheet';
import { DepositSheet } from '../../src/components/wallet/DepositSheet';
import { SecuritySheet } from '../../src/components/wallet/SecuritySheet';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null) return '--';
  if (value < 0.01 && value > 0) return '<$0.01';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProfileScreen() {
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

  // Wallet hooks
  const { solBalance, solBalanceUsd, isLoading: balanceLoading, refresh: refreshBalance } = useWalletBalance(walletAddress);
  const { solPrice } = useSolPrice();
  const { tokens, isLoading: tokensLoading } = useAllTokenBalances(walletAddress);
  const { fundWallet } = useFundSolanaWallet();
  const tokenMints = useMemo(() => tokens.map((t) => t.mint), [tokens]);
  const { stats: tokenStats } = useTokenStats(tokenMints);

  // Photo upload
  const { pickAndUploadPhoto, isUploading: isPhotoUploading } = usePhotoUpload();

  // Creator fees
  const {
    totalClaimable,
    hasClaimableFees,
    launchedTokenCount,
    data: creatorFeesData,
    claimFees,
    isClaiming,
    refresh: refreshCreatorFees,
  } = useMobileCreatorFees(walletAddress);

  // Bottom sheet refs
  const sendRef = useRef<GorhomBottomSheet>(null);
  const depositRef = useRef<GorhomBottomSheet>(null);
  const securityRef = useRef<GorhomBottomSheet>(null);

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Show setup modal when profile needs setup
  const shouldShowSetup = isAuthenticated && needsSetup && !profileLoading;

  // Portfolio value
  const totalPortfolioUsd = useMemo(() => {
    let total = solBalanceUsd || 0;
    for (const token of tokens) {
      const stat = tokenStats.get(token.mint);
      if (stat?.price) {
        total += token.uiAmount * stat.price;
      }
    }
    return total;
  }, [solBalanceUsd, tokens, tokenStats]);

  const totalStaked = useMemo(
    () => all.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    [all],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBalance();
    refreshCreatorFees();
    setRefreshing(false);
  }, [refreshBalance, refreshCreatorFees]);

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

  const handleBuySol = useCallback(async () => {
    if (!walletAddress) return;
    try {
      await fundWallet({ address: walletAddress, asset: 'SOL', cluster: 'mainnet-beta' });
    } catch {
      // User cancelled
    }
  }, [walletAddress, fundWallet]);

  const handleSwap = useCallback(() => {
    WebBrowser.openBrowserAsync('https://jup.ag/swap/SOL-USDC');
  }, []);

  const handleCopyMint = useCallback(async (mint: string) => {
    await Clipboard.setStringAsync(mint);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleClaimFees = useCallback(async () => {
    const result = await claimFees();
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [claimFees]);

  const handleAvatarPress = useCallback(async () => {
    const url = await pickAndUploadPhoto();
    if (url) {
      const success = await updateProfile({ profilePhotoUrl: url });
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refreshProfile();
      }
    }
  }, [pickAndUploadPhoto, updateProfile, refreshProfile]);

  const handleOpenTwitter = useCallback(() => {
    if (profile?.twitter) {
      Linking.openURL(`https://x.com/${profile.twitter}`);
    }
  }, [profile?.twitter]);

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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.lg }]}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {/* Section 1: User Info */}
        {isAuthenticated ? (
          <View style={styles.userSection}>
            <PressableScale onPress={handleAvatarPress} style={styles.avatarWrapper}>
              <View style={styles.avatarRing}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={32} color={colors.textMuted} />
                  </View>
                )}
              </View>
              {isPhotoUploading ? (
                <View style={styles.cameraBadge}>
                  <ActivityIndicator size={12} color="#fff" />
                </View>
              ) : (
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              )}
            </PressableScale>
            <Text style={styles.displayName}>{displayName}</Text>
            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}
            {profile?.twitter ? (
              <PressableScale onPress={handleOpenTwitter} style={styles.twitterRow}>
                <Ionicons name="logo-twitter" size={14} color={colors.textSecondary} />
                <Text style={styles.twitterHandle}>@{profile.twitter}</Text>
              </PressableScale>
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
              <PressableScale
                style={styles.statItem}
                onPress={() => router.push({ pathname: '/followers', params: { type: 'followers', wallet: walletAddress! } })}
              >
                <Text style={styles.statValue}>{profile?.followerCount ?? 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </PressableScale>
              <View style={styles.statDivider} />
              <PressableScale
                style={styles.statItem}
                onPress={() => router.push({ pathname: '/followers', params: { type: 'following', wallet: walletAddress! } })}
              >
                <Text style={styles.statValue}>{profile?.followingCount ?? 0}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </PressableScale>
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

        {/* ─── WALLET SECTION ─── */}
        {isAuthenticated && (
          <>
            {/* Balance Card */}
            <GlassCard style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balanceUsd}>{formatUsd(totalPortfolioUsd)}</Text>
              <View style={styles.solRow}>
                <Text style={styles.solBalance}>
                  {balanceLoading ? '...' : solBalance.toFixed(4)} SOL
                </Text>
                {solPrice && (
                  <Text style={styles.solUsdHint}>@ {formatUsd(solPrice)}/SOL</Text>
                )}
              </View>
            </GlassCard>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <ActionButton icon="card-outline" label="Buy" color={colors.success} onPress={handleBuySol} />
              <ActionButton icon="send-outline" label="Send" color={colors.primary} onPress={() => sendRef.current?.snapToIndex(0)} />
              <ActionButton icon="download-outline" label="Receive" color="#22d3ee" onPress={() => depositRef.current?.snapToIndex(0)} />
              <ActionButton icon="swap-horizontal-outline" label="Swap" color={colors.accent} onPress={handleSwap} />
            </View>

            {/* Token List */}
            <SectionHeader title="Your Tokens" count={tokens.length + 1} />

            {/* SOL row */}
            <PressableScale
              onPress={walletAddress ? () => handleCopyMint(walletAddress) : undefined}
              style={styles.tokenRow}
            >
              <LinearGradient
                colors={['#9945FF', '#14F195']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tokenLogo}
              >
                <Text style={styles.tokenLogoText}>S</Text>
              </LinearGradient>
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenSymbol}>SOL</Text>
                <Text style={styles.tokenName}>Solana</Text>
              </View>
              <View style={styles.tokenValues}>
                <Text style={styles.tokenBalanceText}>{solBalance.toFixed(4)}</Text>
                <Text style={styles.tokenUsd}>{formatUsd(solBalanceUsd)}</Text>
              </View>
            </PressableScale>

            {/* SPL tokens */}
            {tokensLoading && tokens.length === 0 ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingRowText}>Loading tokens...</Text>
              </View>
            ) : (
              tokens.map((token) => {
                const stat = tokenStats.get(token.mint);
                const tokenUsd = stat?.price ? token.uiAmount * stat.price : null;
                const change = stat?.priceChange24h;

                return (
                  <PressableScale
                    key={token.mint}
                    onPress={() => handleCopyMint(token.mint)}
                    style={styles.tokenRow}
                  >
                    {token.logoURI ? (
                      <Image source={{ uri: token.logoURI }} style={styles.tokenLogo} />
                    ) : (
                      <View style={[styles.tokenLogo, styles.tokenLogoPlaceholder]}>
                        <Text style={styles.tokenLogoText}>
                          {token.symbol?.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.tokenInfo}>
                      <Text style={styles.tokenSymbol}>{token.symbol || 'Unknown'}</Text>
                      <Text style={styles.tokenName} numberOfLines={1}>
                        {token.name || 'Unknown Token'}
                      </Text>
                    </View>
                    <View style={styles.tokenValues}>
                      <Text style={styles.tokenBalanceText}>
                        {token.uiAmount < 1000
                          ? token.uiAmount.toFixed(2)
                          : token.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </Text>
                      <View style={styles.tokenUsdRow}>
                        {tokenUsd != null && (
                          <Text style={styles.tokenUsd}>{formatUsd(tokenUsd)}</Text>
                        )}
                        {change != null && (
                          <Text
                            style={[
                              styles.changeText,
                              { color: change >= 0 ? colors.success : colors.danger },
                            ]}
                          >
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                          </Text>
                        )}
                      </View>
                    </View>
                  </PressableScale>
                );
              })
            )}
          </>
        )}

        {/* ─── PORTFOLIO TABS (Predictions / Projects / Watchlist) ─── */}
        {isAuthenticated && walletAddress && (
          <>
            <PortfolioTabs
              walletAddress={walletAddress}
              active={active}
              claimable={claimable}
              resolved={resolved}
              all={all}
              positionsLoading={positionsLoading}
              totalStaked={totalStaked}
              favoriteMarketIds={profile?.favoriteMarkets ?? []}
            />

            {/* Creator Fees */}
            {launchedTokenCount > 0 && (
              <>
                <SectionHeader title="Creator Fees" count={launchedTokenCount} style={styles.sectionGap} />
                <GlassCard style={styles.creatorCard}>
                  <View style={styles.creatorHeader}>
                    <Ionicons name="gift-outline" size={20} color={colors.accent} />
                    <Text style={styles.creatorTitle}>Claimable Fees</Text>
                  </View>
                  <Text style={styles.creatorAmount}>
                    {totalClaimable.toFixed(6)} SOL
                  </Text>
                  {solPrice && (
                    <Text style={styles.creatorUsd}>
                      {formatUsd(totalClaimable * solPrice)}
                    </Text>
                  )}

                  {creatorFeesData?.tokens?.map((item) => (
                    <View key={item.token.tokenAddress} style={styles.feeTokenRow}>
                      <View style={styles.feeTokenInfo}>
                        <Text style={styles.feeTokenSymbol}>{item.token.symbol}</Text>
                        <Text style={styles.feeTokenName}>{item.token.name}</Text>
                      </View>
                      <Text style={styles.feeTokenAmount}>
                        {item.claimableAmount.toFixed(6)} SOL
                      </Text>
                    </View>
                  ))}

                  {hasClaimableFees && (
                    <PressableScale
                      onPress={handleClaimFees}
                      disabled={isClaiming}
                      style={styles.claimButton}
                    >
                      <LinearGradient
                        colors={[colors.gradientStart, colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.claimGradient}
                      >
                        {isClaiming ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="download-outline" size={16} color="#fff" />
                            <Text style={styles.claimText}>Claim All</Text>
                          </>
                        )}
                      </LinearGradient>
                    </PressableScale>
                  )}
                </GlassCard>
              </>
            )}
          </>
        )}

        {/* Section: Create */}
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

        {/* Section: Settings */}
        <SectionHeader title="Settings" style={styles.sectionGap} />
        <View style={styles.settingsList}>
          {isAuthenticated && (
            <SettingsRow
              icon="create-outline"
              label="Edit Profile"
              onPress={() => setShowSetupModal(true)}
            />
          )}
          {isAuthenticated && (
            <SettingsRow
              icon="key-outline"
              label="Export Private Key"
              onPress={() => securityRef.current?.snapToIndex(0)}
            />
          )}
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

        {/* Footer */}
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

      {/* Bottom Sheets */}
      {walletAddress && (
        <>
          <SendSheet
            ref={sendRef}
            walletAddress={walletAddress}
            solBalance={solBalance}
            tokens={tokens}
            onClose={() => sendRef.current?.close()}
            onSuccess={() => refreshBalance()}
          />
          <DepositSheet
            ref={depositRef}
            walletAddress={walletAddress}
            onClose={() => depositRef.current?.close()}
          />
          <SecuritySheet
            ref={securityRef}
            walletAddress={walletAddress}
            onClose={() => securityRef.current?.close()}
          />
        </>
      )}
    </View>
  );
}

/* ---------- Sub-components ---------- */

function ActionButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.actionBtn}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </PressableScale>
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

/* ---------- Styles ---------- */

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
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  twitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  twitterHandle: {
    ...typography.caption,
    color: colors.textSecondary,
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

  // ─── Wallet: Balance Card ───
  balanceCard: {
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceUsd: {
    ...typography.numericLarge,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  solRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  solBalance: {
    ...typography.numeric,
    color: colors.textSecondary,
    fontSize: 14,
  },
  solUsdHint: {
    ...typography.micro,
    color: colors.textMuted,
  },

  // ─── Wallet: Action Buttons ───
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.micro,
    color: colors.textSecondary,
  },

  // ─── Wallet: Token List ───
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  tokenLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenLogoPlaceholder: {
    backgroundColor: colors.surfaceElevated,
  },
  tokenLogoText: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 16,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  tokenName: {
    ...typography.micro,
    color: colors.textMuted,
  },
  tokenValues: {
    alignItems: 'flex-end',
  },
  tokenBalanceText: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  tokenUsd: {
    ...typography.micro,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  tokenUsdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeText: {
    ...typography.micro,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingRowText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // ─── Wallet: Creator Fees ───
  creatorCard: {
    padding: spacing.md,
  },
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  creatorTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  creatorAmount: {
    ...typography.numericLarge,
    color: colors.textPrimary,
    fontSize: 22,
  },
  creatorUsd: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  feeTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feeTokenInfo: {
    flex: 1,
  },
  feeTokenSymbol: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  feeTokenName: {
    ...typography.micro,
    color: colors.textMuted,
  },
  feeTokenAmount: {
    ...typography.captionBold,
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  claimButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  claimGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
  },
  claimText: {
    ...typography.bodyBold,
    color: '#fff',
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
