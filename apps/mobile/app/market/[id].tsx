/**
 * Market Detail Screen — Full Web Feature Parity
 * - Parallax hero image
 * - Anti-bandwagon vote gauge (hide % when unresolved)
 * - Pool progress, countdown
 * - Market status card (all resolution states, claims, vesting, founder actions)
 * - User position display
 * - Tabbed content: Overview / AI Analysis / Activity
 * - VoteBottomSheet with fee summary
 * - Favorite button, creator badge, social links, on-chain info
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { useAnimatedStyle, useSharedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import useSWR from 'swr';
import { useMarket, useNetwork } from '@pnl/shared/hooks';
import { fetcher } from '@pnl/shared/services';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  ScreenHeader,
  PressableScale,
  VoteGauge,
  PoolProgress,
  TimeCountdown,
  CategoryPill,
  GlassCard,
  EmptyState,
  VoteBottomSheet,
  GrokAnalysis,
  ActivityFeed,
  MarketHolders,
  LockedCard,
  UserPosition,
  MarketStatusCard,
  FavoriteButton,
} from '../../src/components';
import { CommunityHub } from '../../src/components/community';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

const HERO_HEIGHT = 260;
const TABS = ['Overview', 'AI Analysis', 'Activity', 'Community'] as const;
type TabName = (typeof TABS)[number];
type VoteDirection = 'yes' | 'no';

// ── Helpers ────────────────────────────────────────────────────────────────

function truncateAddress(addr?: string): string {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getExplorerUrl(address: string, network: string): string {
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  return `https://solscan.io/account/${address}${cluster}`;
}

function formatLabel(value: string): string {
  const map: Record<string, string> = {
    dao: 'DAO', nft: 'NFT', ai: 'AI/ML', defi: 'DeFi', mvp: 'MVP',
    realestate: 'Real Estate', 'real estate': 'Real Estate',
  };
  if (map[value.toLowerCase()]) return map[value.toLowerCase()];
  return value.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { market, isLoading, error, refresh: refreshMarket } = useMarket(id ?? null);
  const { isAuthenticated, walletAddress } = useAuth();
  const { network } = useNetwork();
  const [isVoting, setIsVoting] = useState(false);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabName>('Overview');

  // ── Position data (platform-agnostic SWR) ──
  const { data: positionResponse, mutate: refetchPosition } = useSWR(
    id && walletAddress ? `/api/markets/${id}/position?wallet=${walletAddress}&network=${network}` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 },
  );
  const positionData = (positionResponse as any)?.success ? (positionResponse as any).data : null;

  // ── Activity + holders data (only for resolved markets) ──
  const [holdersData, setHoldersData] = useState<any>(null);
  useEffect(() => {
    if (!id || !market?.resolution || market.resolution === 'Unresolved') return;
    let mounted = true;
    const fetchHolders = async () => {
      try {
        const res = await fetch(apiUrl(`/api/markets/${id}/activity?network=${network}`));
        const data = await res.json();
        if (mounted && data.success) setHoldersData(data.data);
      } catch { /* non-critical */ }
    };
    fetchHolders();
    return () => { mounted = false; };
  }, [id, network, market?.resolution]);

  // ── Vesting data (founder-only, YesWins markets) ──
  const isFounder = !!walletAddress && !!market?.founderWallet && walletAddress === market.founderWallet;
  const isYesWins = market?.resolution === 'YesWins';
  const { data: vestingResponse } = useSWR(
    isYesWins && market?.marketAddress
      ? `/api/markets/${market.marketAddress}/vesting?network=${network}`
      : null,
    fetcher,
    { dedupingInterval: 30000 },
  );
  const vestingData = (vestingResponse as any)?.success ? (vestingResponse as any).data : null;

  // ── Parallax scroll ──
  const scrollY = useSharedValue(0);
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
  }, []);
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-100, 0, HERO_HEIGHT], [-50, 0, HERO_HEIGHT * 0.4], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-100, 0], [1.3, 1], Extrapolation.CLAMP) },
    ],
  }));
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_HEIGHT - 120, HERO_HEIGHT - 60], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Vote sheet ──
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const [voteDirection, setVoteDirection] = useState<VoteDirection | null>(null);

  // ── Derived state ──
  const isResolved = market?.resolution && market.resolution !== 'Unresolved';
  const isExpired = market?.expiryTime ? new Date(market.expiryTime) < new Date() : false;
  const yesDisabled = !market?.isYesVoteEnabled || isExpired;
  const noDisabled = !market?.isNoVoteEnabled || isExpired;
  const totalParticipants = (market?.yesVotes ?? 0) + (market?.noVotes ?? 0);
  const yesPercent = market?.yesPercentage ?? 50;
  const noPercent = market?.noPercentage ?? 50;

  const grokVotingData = useMemo(() => {
    if (!market) return undefined;
    return { totalYesVotes: market.yesVotes ?? 0, totalNoVotes: market.noVotes ?? 0, yesPercentage: yesPercent, totalParticipants };
  }, [market, yesPercent, totalParticipants]);

  // ── Handlers ──

  const handleVote = useCallback(
    (direction: VoteDirection) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!isAuthenticated) { router.push('/login'); return; }
      if (direction === 'yes' && yesDisabled) {
        if (market?.yesVoteDisabledReason) Alert.alert('Cannot Vote', market.yesVoteDisabledReason);
        return;
      }
      if (direction === 'no' && noDisabled) {
        if (market?.noVoteDisabledReason) Alert.alert('Cannot Vote', market.noVoteDisabledReason);
        return;
      }
      setVoteDirection(direction);
      sheetRef.current?.snapToIndex(0);
    },
    [isAuthenticated, yesDisabled, noDisabled, market],
  );

  const handleVoteConfirm = useCallback(
    async (direction: VoteDirection, amount: number) => {
      if (!market || !walletAddress) return;
      sheetRef.current?.close();
      setIsVoting(true);
      try {
        const prepareRes = await fetch(apiUrl('/api/markets/vote/prepare'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketAddress: market.marketAddress, voteType: direction, amount, userWallet: walletAddress, network }),
        });
        const prepareData = await prepareRes.json();
        if (!prepareData.success) throw new Error(prepareData.error || 'Failed to prepare vote transaction');
        // TODO: Sign with Privy Expo SDK
        Alert.alert('Transaction Prepared', 'On-chain signing via Privy Expo SDK is not yet wired. The transaction was prepared successfully.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetchPosition();
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Vote Failed', err.message || 'Something went wrong');
      } finally {
        setIsVoting(false);
      }
    },
    [market, walletAddress, network, refetchPosition],
  );

  const handleShare = useCallback(async () => {
    if (!market) return;
    await Share.share({ message: `Check out "${market.name}" on PNL — predict & launch!`, url: `https://pnl.fun/market/${market.id}` });
  }, [market]);

  const handleCopyAddress = useCallback(async (addr: string) => {
    await Clipboard.setStringAsync(addr);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied', 'Address copied to clipboard');
  }, []);

  // ── Loading / Error ──

  if (isLoading && !market) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading market...</Text>
      </View>
    );
  }

  if (error || !market) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Failed to load market"
          subtitle="This market may no longer exist"
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const getDisabledReason = (dir: VoteDirection): string | null => {
    if (isResolved) return 'Market has been resolved';
    if (isExpired) return 'Market has expired';
    if (dir === 'yes' && market.yesVoteDisabledReason) return market.yesVoteDisabledReason;
    if (dir === 'no' && market.noVoteDisabledReason) return market.noVoteDisabledReason;
    return null;
  };

  const disabledReason = getDisabledReason('yes') || getDisabledReason('no');

  // ── Render ──

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        transparent
        left={
          <PressableScale onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </PressableScale>
        }
        right={
          <View style={styles.headerRight}>
            <FavoriteButton
              marketId={market.id}
              walletAddress={walletAddress}
              initialCount={(market as any).favoriteCount ?? 0}
            />
            <PressableScale onPress={handleShare} style={styles.headerButton}>
              <Ionicons name="share-outline" size={22} color="#fff" />
            </PressableScale>
          </View>
        }
      />
      <Animated.View style={[styles.headerBg, { height: insets.top + 52 }, headerBgStyle]} />

      {/* Tabs — always visible, outside ScrollView so Community tab can manage its own scroll */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <PressableScale key={tab} onPress={() => setActiveTab(tab)} haptic={false} style={[styles.tab, activeTab === tab && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </PressableScale>
        ))}
      </View>

      {/* Community tab renders outside ScrollView (has its own FlatList) */}
      {activeTab === 'Community' ? (
        <CommunityHub
          marketId={market.id}
          marketAddress={market.marketAddress}
          marketName={market.name}
          walletAddress={walletAddress}
          founderWallet={(market as any).founderWallet}
          hasPosition={!!positionData}
        />
      ) : (
        <ScrollView
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        >
          {/* Parallax hero */}
          <Animated.View style={[styles.heroContainer, heroStyle]}>
            {market.projectImageUrl ? (
              <Image source={{ uri: market.projectImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            ) : (
              <LinearGradient colors={[colors.gradientStart, colors.background]} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={['transparent', colors.background]} style={styles.heroScrim} />
          </Animated.View>

          {/* Market info */}
          <View style={styles.infoSection}>
            <View style={styles.pillRow}>
              {market.category && <CategoryPill label={formatLabel(market.category)} variant="tag" />}
              {market.displayStatus && <CategoryPill label={market.displayStatus} variant="tag" />}
              {(market as any).projectAge && <CategoryPill label={(market as any).projectAge} variant="tag" />}
            </View>

            <Text style={styles.title}>{market.name}</Text>

            {/* Creator badge */}
            {(market as any).founderWallet && (
              <View style={styles.creatorRow}>
                <Ionicons name="person-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.creatorText}>
                  by {(market as any).founderDisplayName || (market as any).founderUsername || truncateAddress((market as any).founderWallet)}
                </Text>
              </View>
            )}

            {market.description && (
              <Text style={styles.description} numberOfLines={4}>{market.description}</Text>
            )}
          </View>

          {/* Vote gauge — conditional */}
          <View style={styles.section}>
            {isResolved ? (
              <VoteGauge yesPercent={yesPercent} noPercent={noPercent} yesCount={market.yesVotes} noCount={market.noVotes} variant="detailed" />
            ) : (
              <View style={styles.antiBandwagon}>
                <View style={styles.antiBandwagonBar}>
                  <View style={[styles.antiBandwagonFill, { flex: 1, backgroundColor: colors.surface }]} />
                </View>
                <Text style={styles.antiBandwagonText}>
                  {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''} voted
                </Text>
              </View>
            )}
          </View>

          {/* Pool progress */}
          <View style={styles.section}>
            <PoolProgress
              current={market.poolBalance ? Number(market.poolBalance) : 0}
              target={market.targetPool ? Number(market.targetPool) : 0}
              variant="card"
            />
          </View>

          {/* Countdown */}
          {(market as any).endTime && (
            <GlassCard style={styles.countdownCard}>
              <View style={styles.countdownRow}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.countdownLabel}>Time Remaining</Text>
                <TimeCountdown endTime={(market as any).endTime} />
              </View>
            </GlassCard>
          )}

          {/* Market Status Card (resolution, claims, founder actions, vesting) */}
          <View style={styles.section}>
            <MarketStatusCard
              market={market as any}
              positionData={positionData}
              vestingData={vestingData}
              walletAddress={walletAddress}
              network={network}
              onRefresh={() => { refreshMarket(); refetchPosition(); }}
            />
          </View>

          {/* User position */}
          {positionData && (
            <View style={styles.section}>
              <UserPosition positionData={positionData} />
            </View>
          )}

          {/* Tab content */}
          <View style={styles.tabContent}>
            {activeTab === 'Overview' && (
              <OverviewTab market={market} network={network} onCopyAddress={handleCopyAddress} />
            )}
            {activeTab === 'AI Analysis' && (
              <GrokAnalysis marketId={market.id} resolution={market.resolution} votingData={grokVotingData} />
            )}
            {activeTab === 'Activity' && (
              isResolved ? (
                <View style={{ gap: spacing.lg }}>
                  <ActivityFeed marketId={market.id} />
                  {holdersData ? (
                    <MarketHolders
                      yesHolders={holdersData.yesHolders ?? []}
                      noHolders={holdersData.noHolders ?? []}
                      totalYesStake={holdersData.totalYesStake ?? 0}
                      totalNoStake={holdersData.totalNoStake ?? 0}
                      uniqueHolders={holdersData.uniqueHolders ?? 0}
                      yesPercentage={market.yesPercentage}
                      noPercentage={market.noPercentage}
                      currentUserWallet={walletAddress ?? undefined}
                    />
                  ) : null}
                </View>
              ) : (
                <LockedCard />
              )
            )}
          </View>
        </ScrollView>
      )}

      {/* Sticky vote buttons */}
      <View style={[styles.stickyVotes, { paddingBottom: insets.bottom || 16 }]}>
        <PressableScale
          onPress={() => handleVote('yes')}
          style={[styles.voteButton, styles.yesButton, (yesDisabled || isVoting) && styles.voteButtonDisabled]}
          disabled={isVoting}
        >
          <Ionicons name="trending-up" size={20} color="#fff" />
          <Text style={styles.voteButtonText}>{isVoting && voteDirection === 'yes' ? 'Voting...' : 'Vote YES'}</Text>
        </PressableScale>
        <PressableScale
          onPress={() => handleVote('no')}
          style={[styles.voteButton, styles.noButton, (noDisabled || isVoting) && styles.voteButtonDisabled]}
          disabled={isVoting}
        >
          <Ionicons name="trending-down" size={20} color="#fff" />
          <Text style={styles.voteButtonText}>{isVoting && voteDirection === 'no' ? 'Voting...' : 'Vote NO'}</Text>
        </PressableScale>
      </View>

      {/* Disabled reason */}
      {disabledReason && !isVoting ? (
        <View style={[styles.disabledBanner, { bottom: (insets.bottom || 16) + 60 }]}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
          <Text style={styles.disabledText}>{disabledReason}</Text>
        </View>
      ) : null}

      {/* Vote bottom sheet */}
      <VoteBottomSheet
        ref={sheetRef}
        direction={voteDirection}
        marketTitle={market.name}
        onConfirm={handleVoteConfirm}
        onClose={() => setVoteDirection(null)}
      />
    </View>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ market, network, onCopyAddress }: { market: any; network: string; onCopyAddress: (addr: string) => void }) {
  const metadata = market.metadata;

  return (
    <View style={ov.container}>
      {/* Full description */}
      {market.description ? <Text style={ov.description}>{market.description}</Text> : null}

      {/* Video embed link */}
      {metadata?.videoUrl ? (
        <PressableScale onPress={() => Linking.openURL(metadata.videoUrl)} style={ov.videoLink}>
          <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
          <Text style={ov.videoLinkText}>Watch Project Video</Text>
          <Ionicons name="open-outline" size={14} color={colors.textMuted} />
        </PressableScale>
      ) : null}

      {/* Additional notes */}
      {metadata?.additionalNotes ? (
        <GlassCard style={ov.notesCard}>
          <Text style={ov.notesTitle}>What This Project Offers</Text>
          <Text style={ov.notesText}>{metadata.additionalNotes}</Text>
        </GlassCard>
      ) : null}

      {/* Metadata tags */}
      <View style={ov.metaGrid}>
        {market.tokenSymbol ? <MetaTag label="Token" value={`$${market.tokenSymbol}`} /> : null}
        {market.category ? <MetaTag label="Category" value={formatLabel(market.category)} /> : null}
        {market.stage ? <MetaTag label="Stage" value={formatLabel(market.stage)} /> : null}
        {market.phase ? <MetaTag label="Phase" value={market.phase} /> : null}
        {metadata?.projectType ? <MetaTag label="Type" value={formatLabel(metadata.projectType)} /> : null}
        {metadata?.teamSize ? <MetaTag label="Team Size" value={String(metadata.teamSize)} /> : null}
        {metadata?.location ? <MetaTag label="Location" value={metadata.location} /> : null}
      </View>

      {/* Social links */}
      {metadata?.socialLinks && Object.values(metadata.socialLinks).some(Boolean) ? (
        <View style={ov.socialSection}>
          <Text style={ov.sectionTitle}>Links</Text>
          <View style={ov.socialGrid}>
            {metadata.socialLinks.website ? <SocialLink icon="globe-outline" label="Website" url={metadata.socialLinks.website} /> : null}
            {metadata.socialLinks.twitter ? <SocialLink icon="logo-twitter" label="Twitter" url={metadata.socialLinks.twitter} /> : null}
            {metadata.socialLinks.discord ? <SocialLink icon="logo-discord" label="Discord" url={metadata.socialLinks.discord} /> : null}
            {metadata.socialLinks.github ? <SocialLink icon="logo-github" label="GitHub" url={metadata.socialLinks.github} /> : null}
            {metadata.socialLinks.telegram ? <SocialLink icon="paper-plane-outline" label="Telegram" url={metadata.socialLinks.telegram} /> : null}
          </View>
        </View>
      ) : null}

      {/* Documents */}
      {market.documentUrls?.length > 0 ? (
        <View style={ov.socialSection}>
          <Text style={ov.sectionTitle}>Documents</Text>
          {market.documentUrls.map((url: string, i: number) => (
            <SocialLink key={i} icon="document-outline" label={`Document ${i + 1}`} url={url} />
          ))}
        </View>
      ) : null}

      {/* On-chain info */}
      <View style={ov.onchainSection}>
        <Text style={ov.sectionTitle}>On-chain Info</Text>
        {market.marketAddress ? (
          <AddressRow label="Market" address={market.marketAddress} network={network} onCopy={onCopyAddress} />
        ) : null}
        {market.founderWallet ? (
          <AddressRow label="Founder" address={market.founderWallet} network={network} onCopy={onCopyAddress} color={colors.accent} />
        ) : null}
        {market.id ? (
          <AddressRow label="Market ID" address={market.id} network={network} onCopy={onCopyAddress} noExplorer />
        ) : null}
      </View>
    </View>
  );
}

function MetaTag({ label, value }: { label: string; value: string }) {
  return (
    <View style={ov.metaTag}>
      <Text style={ov.metaLabel}>{label}</Text>
      <Text style={ov.metaValue}>{value}</Text>
    </View>
  );
}

function SocialLink({ icon, label, url }: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string }) {
  return (
    <PressableScale onPress={() => Linking.openURL(url)} style={ov.socialLink}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={ov.socialLinkText}>{label}</Text>
      <Ionicons name="open-outline" size={12} color={colors.textMuted} />
    </PressableScale>
  );
}

function AddressRow({ label, address, network, onCopy, noExplorer, color }: {
  label: string; address: string; network: string; onCopy: (addr: string) => void; noExplorer?: boolean; color?: string;
}) {
  return (
    <View style={ov.addressRow}>
      <Text style={[ov.addressLabel, color ? { color } : undefined]}>{label}</Text>
      <View style={ov.addressActions}>
        <Text style={ov.addressValue}>{truncateAddress(address)}</Text>
        <PressableScale onPress={() => onCopy(address)} style={ov.addressBtn}>
          <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
        </PressableScale>
        {!noExplorer ? (
          <PressableScale onPress={() => Linking.openURL(getExplorerUrl(address, network))} style={ov.addressBtn}>
            <Ionicons name="open-outline" size={14} color={colors.textMuted} />
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const ov = StyleSheet.create({
  container: { gap: spacing.lg },
  description: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  videoLink: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(129,140,248,0.1)', borderRadius: borderRadius.md, padding: spacing.md,
    borderWidth: 1, borderColor: 'rgba(129,140,248,0.2)',
  },
  videoLinkText: { ...typography.captionBold, color: colors.primary, flex: 1 },
  notesCard: { padding: spacing.md, gap: spacing.sm },
  notesTitle: { ...typography.captionBold, color: '#22d3ee' },
  notesText: { ...typography.caption, color: colors.textSecondary, lineHeight: 22 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaTag: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
  },
  metaLabel: { ...typography.micro, color: colors.textMuted, marginBottom: 1 },
  metaValue: { ...typography.captionBold, color: colors.textPrimary },
  socialSection: { gap: spacing.sm },
  sectionTitle: { ...typography.captionBold, color: colors.textMuted, textTransform: 'uppercase' as any, letterSpacing: 0.5 },
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  socialLink: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm,
  },
  socialLinkText: { ...typography.captionBold, color: colors.textPrimary },
  onchainSection: { gap: spacing.sm },
  addressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm,
  },
  addressLabel: { ...typography.captionBold, color: colors.textSecondary },
  addressActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addressValue: { ...typography.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  addressBtn: { padding: spacing.xs },
});

// ── Main Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },
  headerButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerRight: { flexDirection: 'row', gap: spacing.sm },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(10,14,26,0.95)', zIndex: 9 },
  heroContainer: { height: HERO_HEIGHT, overflow: 'hidden' },
  heroScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
  scrollContent: {},
  infoSection: { paddingHorizontal: spacing.md, marginTop: -spacing.xl, marginBottom: spacing.lg },
  pillRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.xs },
  description: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  creatorText: { ...typography.caption, color: colors.warning },
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  countdownCard: { marginHorizontal: spacing.md, padding: spacing.md, marginBottom: spacing.lg },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countdownLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.caption, color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  tabContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  stickyVotes: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    backgroundColor: 'rgba(10,14,26,0.92)', borderTopWidth: 1, borderTopColor: colors.border,
  },
  voteButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 16, borderRadius: borderRadius.lg,
  },
  yesButton: { backgroundColor: colors.success },
  noButton: { backgroundColor: colors.danger },
  voteButtonDisabled: { opacity: 0.4 },
  voteButtonText: { ...typography.bodyBold, color: '#fff' },
  antiBandwagon: { gap: spacing.sm },
  antiBandwagonBar: { height: 8, borderRadius: borderRadius.full, backgroundColor: colors.surface, overflow: 'hidden', flexDirection: 'row' },
  antiBandwagonFill: { borderRadius: borderRadius.full },
  antiBandwagonText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  disabledBanner: {
    position: 'absolute', left: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center',
  },
  disabledText: { ...typography.micro, color: colors.textMuted },
});
