/**
 * Profile Tab — Pump.fun-inspired wallet-first layout
 * Compact header → hero balance → action buttons → stat cards → bio → tokens → portfolio → settings
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
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useFundSolanaWallet } from '@privy-io/expo/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  PressableScale,
  GlassCard,
  SectionHeader,
  EmptyState,
  AvatarImage,
} from '../../src/components';
import { ProfileSetupModal } from '../../src/components/ProfileSetupModal';
import { PortfolioTabs } from '../../src/components/PortfolioTabs';
import { SendSheet } from '../../src/components/wallet/SendSheet';
import { DepositSheet } from '../../src/components/wallet/DepositSheet';
import { SecuritySheet } from '../../src/components/wallet/SecuritySheet';
import { TradeSheet } from '../../src/components/TradeSheet';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

const PNL_TOKEN_MINT = '6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump';

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null) return '--';
  if (value < 0.01 && value > 0) return '<$0.01';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const tradeRef = useRef<GorhomBottomSheet>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tokenSortBy, setTokenSortBy] = useState<'value' | 'name' | 'change'>('value');
  const [hideDust, setHideDust] = useState(false);

  // Sorted/filtered token list
  const displayTokens = useMemo(() => {
    let result = [...tokens];
    if (hideDust) {
      result = result.filter((token) => {
        const stat = tokenStats.get(token.mint);
        const usd = stat?.price ? token.uiAmount * stat.price : null;
        return usd === null || usd >= 0.01;
      });
    }
    result.sort((a, b) => {
      if (tokenSortBy === 'value') {
        const aUsd = (tokenStats.get(a.mint)?.price ?? 0) * a.uiAmount;
        const bUsd = (tokenStats.get(b.mint)?.price ?? 0) * b.uiAmount;
        return bUsd - aUsd;
      }
      if (tokenSortBy === 'name') return (a.symbol || '').localeCompare(b.symbol || '');
      if (tokenSortBy === 'change') {
        const aChange = tokenStats.get(a.mint)?.priceChange24h ?? 0;
        const bChange = tokenStats.get(b.mint)?.priceChange24h ?? 0;
        return bChange - aChange;
      }
      return 0;
    });
    return result;
  }, [tokens, tokenStats, tokenSortBy, hideDust]);

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

  // Unified initial loading — show skeleton until core data is ready
  const isInitialLoad = isAuthenticated && (profileLoading || balanceLoading) && !profile && solBalance === 0;

  if (isInitialLoad) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingHorizontal: spacing.md }]}>
        {/* Skeleton header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceElevated }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: '50%', height: 14, borderRadius: 4, backgroundColor: colors.surfaceElevated }} />
            <View style={{ width: '30%', height: 10, borderRadius: 4, backgroundColor: colors.surfaceElevated }} />
          </View>
        </View>
        {/* Skeleton balance */}
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <View style={{ width: 120, height: 28, borderRadius: 6, backgroundColor: colors.surfaceElevated }} />
          <View style={{ width: 80, height: 12, borderRadius: 4, backgroundColor: colors.surfaceElevated }} />
        </View>
        {/* Skeleton actions */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated }} />
              <View style={{ width: 30, height: 8, borderRadius: 4, backgroundColor: colors.surfaceElevated }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Compact Header (replaces ScreenHeader) ─── */}
      {isAuthenticated ? (
        <View style={[styles.compactHeader, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerLeft}>
            <PressableScale onPress={handleAvatarPress} style={styles.headerAvatarWrap}>
              <AvatarImage
                uri={avatarUrl}
                size={styles.headerAvatar.width}
                fallbackIconSize={16}
              />
              {isPhotoUploading && (
                <ActivityIndicator size={10} color={colors.primary} style={{ position: 'absolute' }} />
              )}
            </PressableScale>
            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            {walletAddress && (
              <PressableScale onPress={handleCopyAddress} style={styles.headerAddr}>
                <Text style={styles.headerAddrText}>{truncateAddress(walletAddress)}</Text>
                <Ionicons name="copy-outline" size={12} color={colors.textMuted} />
              </PressableScale>
            )}
          </View>
          <PressableScale onPress={() => setShowMenu((v) => !v)}>
            <Ionicons name="menu-outline" size={24} color={colors.textSecondary} />
          </PressableScale>
        </View>
      ) : (
        <View style={{ height: insets.top + 8 }} />
      )}

      {/* ─── Hamburger dropdown ─── */}
      {showMenu && (
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuDropdown, { top: insets.top + 52 }]}>
            <PressableScale
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); setShowSetupModal(true); }}
            >
              <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.menuItemText}>Edit Profile</Text>
            </PressableScale>
            <PressableScale
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); securityRef.current?.snapToIndex(0); }}
            >
              <Ionicons name="key-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.menuItemText}>Export Private Key</Text>
            </PressableScale>
            <PressableScale
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); router.push('/whitepaper'); }}
            >
              <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.menuItemText}>Whitepaper</Text>
            </PressableScale>
            <PressableScale
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); router.push('/help'); }}
            >
              <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.menuItemText}>Help & Support</Text>
            </PressableScale>
            <PressableScale
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => { setShowMenu(false); handleLogout(); }}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Sign Out</Text>
            </PressableScale>
          </View>
        </Pressable>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.lg }]}
        onScrollBeginDrag={() => showMenu && setShowMenu(false)}
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
        {isAuthenticated ? (
          <>
            {/* ─── Hero Balance ─── */}
            <View style={styles.heroSection}>
              <Text style={styles.heroUsd}>{formatUsd(totalPortfolioUsd)}</Text>
              <View style={styles.heroSolRow}>
                <Text style={styles.heroSol}>
                  {solBalance.toFixed(4)} SOL
                </Text>
                {solPrice && (
                  <Text style={styles.heroSolHint}>@ {formatUsd(solPrice)}/SOL</Text>
                )}
              </View>
            </View>

            {/* ─── Action Buttons ─── */}
            <View style={styles.actionsRow}>
              <ActionButton icon="send-outline" label="Send" color={colors.primary} onPress={() => sendRef.current?.snapToIndex(0)} />
              <ActionButton icon="download-outline" label="Receive" color="#22d3ee" onPress={() => depositRef.current?.snapToIndex(0)} />
              <ActionButton icon="swap-horizontal-outline" label="Swap" color={colors.accent} onPress={() => tradeRef.current?.snapToIndex(0)} />
              <ActionButton icon="card-outline" label="Buy" color={colors.success} onPress={handleBuySol} />
              <ActionButton icon="add-circle-outline" label="Create" color="#f59e0b" onPress={() => router.push('/create')} />
            </View>

            {/* Creator fees banner — prominent if claimable */}
            {hasClaimableFees && totalClaimable > 0 && (
              <View style={styles.creatorFeesBanner}>
                <Ionicons name="star" size={16} color="#f59e0b" />
                <Text style={styles.creatorFeesText}>
                  {launchedTokenCount} token{launchedTokenCount > 1 ? 's' : ''} launched · {totalClaimable.toFixed(4)} SOL pending
                </Text>
                <Text style={styles.creatorFeesAction}>Claim ↓</Text>
              </View>
            )}

            {/* ─── Stats Cards ─── */}
            <View style={styles.statsCardRow}>
              <PressableScale
                style={{ flex: 1 }}
                onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                <GlassCard style={styles.statCard}>
                  <Text style={styles.statCardValue}>{profile?.totalPredictions ?? 0}</Text>
                  <Text style={styles.statCardLabel}>Predictions</Text>
                </GlassCard>
              </PressableScale>
              <PressableScale
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/followers', params: { type: 'followers', wallet: walletAddress! } })}
              >
                <GlassCard style={styles.statCard}>
                  <Text style={styles.statCardValue}>{profile?.followerCount ?? 0}</Text>
                  <Text style={styles.statCardLabel}>Followers</Text>
                </GlassCard>
              </PressableScale>
              <PressableScale
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/followers', params: { type: 'following', wallet: walletAddress! } })}
              >
                <GlassCard style={styles.statCard}>
                  <Text style={styles.statCardValue}>{profile?.followingCount ?? 0}</Text>
                  <Text style={styles.statCardLabel}>Following</Text>
                </GlassCard>
              </PressableScale>
            </View>

            {/* ─── Bio + Twitter inline ─── */}
            {!isEditing && (profile?.bio || profile?.twitter) && (
              <PressableScale onPress={handleEditBio} style={styles.bioSection}>
                <Text style={styles.bioInlineText} numberOfLines={2}>
                  {profile?.bio || ''}
                  {profile?.bio && profile?.twitter ? (
                    <Text style={styles.bioDot}> · </Text>
                  ) : null}
                  {profile?.twitter ? (
                    <Text
                      style={styles.bioTwitter}
                      onPress={(e) => { e.stopPropagation?.(); handleOpenTwitter(); }}
                    >
                      @{profile.twitter}
                    </Text>
                  ) : null}
                </Text>
              </PressableScale>
            )}
            {!isEditing && !profile?.bio && !profile?.twitter && (
              <PressableScale onPress={handleEditBio} style={styles.bioSection}>
                <Text style={styles.addBioText}>+ Add bio</Text>
              </PressableScale>
            )}

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

            {/* ─── Token List ─── */}
            <SectionHeader title="Your Tokens" count={displayTokens.length + 1} />

            {/* Sort/filter row */}
            <View style={styles.tokenSortRow}>
              {(['value', 'name', 'change'] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setTokenSortBy(opt)}
                  style={[styles.tokenSortChip, tokenSortBy === opt && styles.tokenSortChipActive]}
                >
                  <Text style={[styles.tokenSortText, tokenSortBy === opt && styles.tokenSortTextActive]}>
                    {opt === 'value' ? 'Value' : opt === 'name' ? 'A-Z' : '24h%'}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setHideDust((v) => !v)}
                style={[styles.tokenSortChip, hideDust && styles.tokenSortChipActive]}
              >
                <Text style={[styles.tokenSortText, hideDust && styles.tokenSortTextActive]}>
                  Hide dust
                </Text>
              </Pressable>
            </View>

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
              displayTokens.map((token) => {
                const stat = tokenStats.get(token.mint);
                const tokenUsd = stat?.price ? token.uiAmount * stat.price : null;
                const change = stat?.priceChange24h;

                return (
                  <PressableScale
                    key={token.mint}
                    onPress={() => {
                      // Navigate to trade if it's a PNL-launched token, otherwise copy mint
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleCopyMint(token.mint);
                    }}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      Alert.alert(token.symbol || 'Token', `${token.name || token.symbol}`, [
                        { text: 'Copy Address', onPress: () => handleCopyMint(token.mint) },
                        { text: 'View on Explorer', onPress: () => Linking.openURL(`https://orb.helius.dev/address/${token.mint}`) },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
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
          <TradeSheet
            ref={tradeRef}
            tokenMint={PNL_TOKEN_MINT}
            tokenSymbol="PNL"
            initialMode="buy"
            onClose={() => tradeRef.current?.close()}
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainerText: {
    color: colors.textMuted,
    marginTop: spacing.md,
    fontSize: 16,
  },
  content: {
    paddingHorizontal: spacing.md,
  },

  // ─── Compact Header ───
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerAvatarWrap: {
    position: 'relative',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    ...typography.captionBold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  headerAddr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  headerAddrText: {
    ...typography.micro,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },

  // ─── Hamburger Menu ───
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  menuDropdown: {
    position: 'absolute',
    right: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    zIndex: 101,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    ...typography.body,
    color: colors.textPrimary,
  },

  // ─── Hero Balance ───
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  heroUsd: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroSolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroSol: {
    ...typography.numeric,
    color: colors.textSecondary,
    fontSize: 14,
  },
  heroSolHint: {
    ...typography.micro,
    color: colors.textMuted,
  },

  // ─── Action Buttons ───
  creatorFeesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  creatorFeesText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  creatorFeesAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
  tokenSortRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  tokenSortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tokenSortChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(129,140,248,0.12)',
  },
  tokenSortText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tokenSortTextActive: {
    color: colors.primary,
  },
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

  // ─── Stats Cards ───
  statsCardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xs,
  },
  statCardValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 18,
  },
  statCardLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ─── Bio Section ───
  bioSection: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  bioInlineText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bioDot: {
    color: colors.textMuted,
  },
  bioTwitter: {
    color: colors.primary,
  },
  addBioText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
  },

  // ─── Bio editing ───
  editBioContainer: {
    width: '100%',
    marginBottom: spacing.md,
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

  // ─── Sign in section ───
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

  // ─── Token List ───
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

  // ─── Creator Fees ───
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

  sectionGap: {
    marginTop: spacing.md,
  },

  // ─── Footer ───
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
