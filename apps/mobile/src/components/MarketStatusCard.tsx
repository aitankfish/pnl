/**
 * MarketStatusCard — Full resolution-aware status card
 * Ported from web market detail page right sidebar.
 * Handles: active, pool complete, funding, expired, YesWins, NoWins, Refund
 * Includes: claim buttons, founder actions, vesting, close market
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiUrl } from '@pnl/shared/utils';
import { colors, spacing, borderRadius, typography } from '../theme';
import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';

// ── Types ──────────────────────────────────────────────────────────────────

interface MarketData {
  id: string;
  marketAddress: string;
  name: string;
  tokenSymbol: string;
  resolution?: string;
  phase?: string;
  expiryTime?: string;
  poolBalance?: number;
  targetPool?: string;
  poolProgressPercentage?: number;
  yesPercentage?: number;
  noPercentage?: number;
  yesVotes?: number;
  noVotes?: number;
  founderWallet?: string;
  isYesVoteEnabled?: boolean;
  isNoVoteEnabled?: boolean;
}

interface PositionData {
  hasPosition: boolean;
  side?: 'yes' | 'no';
  totalAmount?: number;
  tradeCount?: number;
  claimed?: boolean;
}

interface VestingData {
  teamVesting?: {
    initialized: boolean;
    totalTokens?: number;
    immediateTokens?: number;
    vestedTokens?: number;
    unlockedTokens?: number;
    claimedTokens?: number;
    progressPercentage?: number;
  };
  founderSol?: {
    initialized: boolean;
    hasExcessSol?: boolean;
    totalSol?: number;
    immediateSol?: number;
    vestedSol?: number;
    unlockedSol?: number;
    claimedSol?: number;
    progressPercentage?: number;
  };
  tokenMint?: string;
}

interface MarketStatusCardProps {
  market: MarketData;
  positionData: PositionData | null;
  vestingData: VestingData | null;
  walletAddress: string | null;
  network: string;
  onRefresh: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isExpired(expiryTime?: string): boolean {
  if (!expiryTime) return false;
  return new Date(expiryTime).getTime() < Date.now();
}

function isPoolFull(pct?: number): boolean {
  return (pct ?? 0) >= 100;
}

function isFounder(market: MarketData, wallet: string | null): boolean {
  return !!wallet && !!market.founderWallet && wallet === market.founderWallet;
}

function getYesWinning(market: MarketData): boolean {
  return (market.yesPercentage ?? 50) >= 50;
}

// ── Prepare + Sign pattern (signing is TODO for Privy Expo) ────────────────

async function prepareTransaction(endpoint: string, body: object): Promise<any> {
  const res = await fetch(apiUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Transaction preparation failed');
  return data;
}

// ── Action Button ──────────────────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  color,
  bgColor,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading || disabled}
      style={[styles.actionBtn, { backgroundColor: bgColor, opacity: disabled ? 0.4 : 1 }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={18} color={color} />
      )}
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </PressableScale>
  );
}

// ── Claim Section ──────────────────────────────────────────────────────────

function ClaimSection({
  market,
  positionData,
  walletAddress,
  network,
  onRefresh,
}: {
  market: MarketData;
  positionData: PositionData | null;
  walletAddress: string | null;
  network: string;
  onRefresh: () => void;
}) {
  const [isClaiming, setIsClaiming] = useState(false);
  const resolution = market.resolution;

  if (!positionData?.hasPosition || positionData.claimed) {
    if (positionData?.claimed) {
      return (
        <View style={styles.claimedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.claimedText}>Rewards successfully claimed</Text>
        </View>
      );
    }
    return null;
  }

  const handleClaim = async () => {
    if (!walletAddress) {
      Alert.alert('Connect Wallet', 'Please connect your wallet to claim.');
      return;
    }
    setIsClaiming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const data = await prepareTransaction('/api/markets/claim/prepare', {
        marketAddress: market.marketAddress,
        userWallet: walletAddress,
        network,
      });

      // TODO: Sign with Privy Expo SDK
      Alert.alert(
        'Claim Prepared',
        'Transaction prepared successfully. On-chain signing via Privy Expo SDK is not yet wired.',
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Claim Failed', err.message);
    } finally {
      setIsClaiming(false);
    }
  };

  // Determine claim type
  if (resolution === 'YesWins' && positionData.side === 'yes') {
    if (isFounder(market, walletAddress)) return null; // Founders don't claim token airdrop
    return (
      <ActionButton
        label="Claim Token Airdrop"
        icon="gift-outline"
        color={colors.success}
        bgColor={colors.successLight}
        onPress={handleClaim}
        loading={isClaiming}
      />
    );
  }

  if (resolution === 'NoWins' && positionData.side === 'no') {
    return (
      <ActionButton
        label="Claim SOL Rewards"
        icon="cash-outline"
        color={colors.warning}
        bgColor={colors.warningLight}
        onPress={handleClaim}
        loading={isClaiming}
      />
    );
  }

  if (resolution === 'Refund') {
    return (
      <ActionButton
        label={`Claim Refund (${(Number(positionData.totalAmount) || 0).toFixed(3)} SOL)`}
        icon="arrow-undo-outline"
        color={colors.warning}
        bgColor={colors.warningLight}
        onPress={handleClaim}
        loading={isClaiming}
      />
    );
  }

  return null;
}

// ── Founder Actions ────────────────────────────────────────────────────────

function FounderActions({
  market,
  walletAddress,
  network,
  onRefresh,
}: {
  market: MarketData;
  walletAddress: string | null;
  network: string;
  onRefresh: () => void;
}) {
  const [isExtending, setIsExtending] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  if (!isFounder(market, walletAddress) && market.resolution === 'Unresolved') {
    // Non-founder can resolve NO Wins
    const expired = isExpired(market.expiryTime);
    const yesWinning = getYesWinning(market);
    if (expired && !yesWinning) {
      return (
        <ActionButton
          label="Resolve Market (NO Wins)"
          icon="hammer-outline"
          color={colors.danger}
          bgColor={colors.dangerLight}
          onPress={async () => {
            setIsResolving(true);
            try {
              await prepareTransaction('/api/markets/resolve/prepare', {
                marketAddress: market.marketAddress,
                userWallet: walletAddress,
                network,
                needsTokenLaunch: false,
              });
              Alert.alert('Resolve Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setIsResolving(false);
            }
          }}
          loading={isResolving}
        />
      );
    }
    return null;
  }

  if (!isFounder(market, walletAddress)) return null;

  const expired = isExpired(market.expiryTime);
  const poolFull = isPoolFull(market.poolProgressPercentage);
  const yesWinning = getYesWinning(market);
  const inPrediction = market.phase === 'Prediction' || !market.phase;
  const inFunding = market.phase === 'Funding';

  // Extend to Funding Phase
  if (market.resolution === 'Unresolved' && poolFull && yesWinning && inPrediction && !expired) {
    return (
      <View style={styles.founderSection}>
        <Text style={styles.founderTitle}>Target Reached!</Text>
        <Text style={styles.founderDesc}>
          Extend to Funding Phase to keep raising, or wait for expiry to launch.
        </Text>
        <ActionButton
          label="Extend to Funding Phase"
          icon="expand-outline"
          color={colors.primary}
          bgColor="rgba(129,140,248,0.15)"
          onPress={async () => {
            setIsExtending(true);
            try {
              await prepareTransaction('/api/markets/extend/prepare', {
                marketAddress: market.marketAddress,
                userWallet: walletAddress,
                network,
              });
              Alert.alert('Extend Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setIsExtending(false);
            }
          }}
          loading={isExtending}
        />
      </View>
    );
  }

  // Launch Token (Funding Phase OR expired + YES winning)
  if (market.resolution === 'Unresolved' && (inFunding || (expired && yesWinning))) {
    return (
      <View style={styles.founderSection}>
        <Text style={styles.founderTitle}>
          {inFunding ? 'Funding Phase — Launch Token' : 'YES Wins — Launch Token'}
        </Text>
        <Text style={styles.founderDesc}>
          Launch ${market.tokenSymbol || 'TOKEN'} via pump.fun. YES voters will receive token airdrop.
        </Text>
        <ActionButton
          label={`Launch $${market.tokenSymbol || 'TOKEN'}`}
          icon="rocket-outline"
          color={colors.success}
          bgColor={colors.successLight}
          onPress={async () => {
            setIsResolving(true);
            try {
              await prepareTransaction('/api/markets/resolve/prepare', {
                marketAddress: market.marketAddress,
                userWallet: walletAddress,
                network,
                needsTokenLaunch: true,
                tokenMetadata: {
                  name: market.name,
                  symbol: market.tokenSymbol,
                  description: `${market.name} — community-backed via PNL prediction market`,
                },
              });
              Alert.alert('Launch Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setIsResolving(false);
            }
          }}
          loading={isResolving}
        />
      </View>
    );
  }

  // Resolve NO Wins (founder)
  if (market.resolution === 'Unresolved' && expired && !yesWinning) {
    return (
      <ActionButton
        label="Resolve Market (NO Wins)"
        icon="hammer-outline"
        color={colors.danger}
        bgColor={colors.dangerLight}
        onPress={async () => {
          setIsResolving(true);
          try {
            await prepareTransaction('/api/markets/resolve/prepare', {
              marketAddress: market.marketAddress,
              userWallet: walletAddress,
              network,
              needsTokenLaunch: false,
            });
            Alert.alert('Resolve Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setIsResolving(false);
          }
        }}
        loading={isResolving}
      />
    );
  }

  return null;
}

// ── Team Vesting Section ───────────────────────────────────────────────────

function TeamVestingSection({
  market,
  vestingData,
  walletAddress,
  network,
}: {
  market: MarketData;
  vestingData: VestingData | null;
  walletAddress: string | null;
  network: string;
}) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  if (market.resolution !== 'YesWins') return null;
  if (!isFounder(market, walletAddress) && !vestingData?.teamVesting?.initialized) return null;

  const tv = vestingData?.teamVesting;

  // Show vesting info to everyone if initialized
  if (tv?.initialized) {
    const claimable = (tv.unlockedTokens ?? 0) - (tv.claimedTokens ?? 0);
    const hasClaimable = claimable > 0;

    return (
      <GlassCard style={styles.vestingCard}>
        <View style={styles.vestingHeader}>
          <Ionicons name="people-outline" size={16} color={colors.warning} />
          <Text style={styles.vestingTitle}>Team Token Allocation (33%)</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${tv.progressPercentage ?? 0}%` as any, backgroundColor: colors.warning }]} />
        </View>
        <Text style={styles.vestingMicro}>{(tv.progressPercentage ?? 0).toFixed(0)}% vested</Text>

        {/* Breakdown */}
        <View style={styles.vestingGrid}>
          <VestingRow label="Total Team Tokens" value={formatTokens(tv.totalTokens)} />
          <VestingRow label="Immediate (8%)" value={formatTokens(tv.immediateTokens)} />
          <VestingRow label="Vested (25%, 12mo)" value={formatTokens(tv.vestedTokens)} />
          <VestingRow label="Unlocked" value={formatTokens(tv.unlockedTokens)} highlight />
          <VestingRow label="Already Claimed" value={formatTokens(tv.claimedTokens)} />
        </View>

        {/* Founder claim button */}
        {isFounder(market, walletAddress) && (
          <ActionButton
            label={hasClaimable ? `Claim ${formatTokens(claimable)} Tokens` : 'No Tokens to Claim Yet'}
            icon={hasClaimable ? 'download-outline' : 'time-outline'}
            color={hasClaimable ? colors.warning : colors.textMuted}
            bgColor={hasClaimable ? colors.warningLight : colors.surface}
            disabled={!hasClaimable}
            loading={isClaiming}
            onPress={async () => {
              if (!hasClaimable) return;
              setIsClaiming(true);
              try {
                await prepareTransaction('/api/markets/team-vesting/claim', {
                  marketAddress: market.marketAddress,
                  tokenMint: vestingData?.tokenMint,
                  userWallet: walletAddress,
                  network,
                });
                Alert.alert('Claim Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
              } catch (err: any) {
                Alert.alert('Error', err.message);
              } finally {
                setIsClaiming(false);
              }
            }}
          />
        )}
      </GlassCard>
    );
  }

  // Not initialized — founder can initialize
  if (isFounder(market, walletAddress)) {
    return (
      <GlassCard style={styles.vestingCard}>
        <View style={styles.vestingHeader}>
          <Ionicons name="people-outline" size={16} color={colors.warning} />
          <Text style={styles.vestingTitle}>Team Token Allocation (33%)</Text>
        </View>
        <Text style={styles.vestingDesc}>
          8% available immediately, 25% vested linearly over 12 months.
        </Text>
        <ActionButton
          label="Initialize Team Vesting"
          icon="hammer-outline"
          color={colors.warning}
          bgColor={colors.warningLight}
          loading={isInitializing}
          onPress={async () => {
            setIsInitializing(true);
            try {
              await prepareTransaction('/api/markets/team-vesting/init', {
                marketAddress: market.marketAddress,
                teamWallet: walletAddress,
                userWallet: walletAddress,
                network,
              });
              Alert.alert('Init Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setIsInitializing(false);
            }
          }}
        />
      </GlassCard>
    );
  }

  return null;
}

// ── Founder SOL Vesting Section ────────────────────────────────────────────

function FounderSolVestingSection({
  market,
  vestingData,
  walletAddress,
  network,
}: {
  market: MarketData;
  vestingData: VestingData | null;
  walletAddress: string | null;
  network: string;
}) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  if (market.resolution !== 'YesWins') return null;
  if (!isFounder(market, walletAddress)) return null;

  const fv = vestingData?.founderSol;
  if (!fv?.hasExcessSol && !fv?.initialized) return null;

  if (fv?.initialized) {
    const claimable = (fv.unlockedSol ?? 0) - (fv.claimedSol ?? 0);
    const hasClaimable = claimable > 0;

    return (
      <GlassCard style={styles.vestingCard}>
        <View style={styles.vestingHeader}>
          <Ionicons name="cash-outline" size={16} color={colors.success} />
          <Text style={[styles.vestingTitle, { color: colors.success }]}>Excess SOL Allocation</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${fv.progressPercentage ?? 0}%` as any, backgroundColor: colors.success }]} />
        </View>
        <Text style={styles.vestingMicro}>{(fv.progressPercentage ?? 0).toFixed(0)}% vested</Text>

        <View style={styles.vestingGrid}>
          <VestingRow label="Total Excess SOL" value={`${(fv.totalSol ?? 0).toFixed(3)} SOL`} />
          <VestingRow label="Immediate (8%)" value={`${(fv.immediateSol ?? 0).toFixed(3)} SOL`} />
          <VestingRow label="Vested (92%, 12mo)" value={`${(fv.vestedSol ?? 0).toFixed(3)} SOL`} />
          <VestingRow label="Unlocked" value={`${(fv.unlockedSol ?? 0).toFixed(3)} SOL`} highlight />
          <VestingRow label="Already Claimed" value={`${(fv.claimedSol ?? 0).toFixed(3)} SOL`} />
        </View>

        <ActionButton
          label={hasClaimable ? `Claim ${claimable.toFixed(3)} SOL` : 'No SOL to Claim Yet'}
          icon={hasClaimable ? 'download-outline' : 'time-outline'}
          color={hasClaimable ? colors.success : colors.textMuted}
          bgColor={hasClaimable ? colors.successLight : colors.surface}
          disabled={!hasClaimable}
          loading={isClaiming}
          onPress={async () => {
            if (!hasClaimable) return;
            setIsClaiming(true);
            try {
              await prepareTransaction('/api/markets/founder-sol/claim', {
                marketAddress: market.marketAddress,
                userWallet: walletAddress,
                network,
              });
              Alert.alert('Claim Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setIsClaiming(false);
            }
          }}
        />
      </GlassCard>
    );
  }

  // Not initialized
  return (
    <GlassCard style={styles.vestingCard}>
      <View style={styles.vestingHeader}>
        <Ionicons name="cash-outline" size={16} color={colors.success} />
        <Text style={[styles.vestingTitle, { color: colors.success }]}>Excess SOL Allocation</Text>
      </View>
      <Text style={styles.vestingDesc}>
        Pool exceeded target. 50 SOL used for token launch, the rest is yours with vesting (8% immediate + 92% over 12 months).
      </Text>
      <ActionButton
        label="Initialize SOL Vesting"
        icon="hammer-outline"
        color={colors.success}
        bgColor={colors.successLight}
        loading={isInitializing}
        onPress={async () => {
          setIsInitializing(true);
          try {
            await prepareTransaction('/api/markets/founder-sol/init', {
              marketAddress: market.marketAddress,
              userWallet: walletAddress,
              network,
            });
            Alert.alert('Init Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setIsInitializing(false);
          }
        }}
      />
    </GlassCard>
  );
}

// ── Close Market Section ───────────────────────────────────────────────────

function CloseMarketSection({
  market,
  walletAddress,
  network,
}: {
  market: MarketData;
  walletAddress: string | null;
  network: string;
}) {
  const [isClosing, setIsClosing] = useState(false);

  if (market.resolution === 'Unresolved') return null;
  if (!isFounder(market, walletAddress)) return null;

  return (
    <GlassCard style={styles.closeCard}>
      <Text style={styles.closeTitle}>Market Cleanup (Founder Only)</Text>
      <Text style={styles.closeDesc}>
        After 30 days from market expiry and when all rewards have been claimed, you can close the market to recover rent (~0.01 SOL).
      </Text>
      <ActionButton
        label="Close Market & Recover Rent"
        icon="trash-outline"
        color={colors.textMuted}
        bgColor={colors.surface}
        loading={isClosing}
        onPress={async () => {
          setIsClosing(true);
          try {
            await prepareTransaction('/api/markets/close-market', {
              marketAddress: market.marketAddress,
              userWallet: walletAddress,
              network,
            });
            Alert.alert('Close Prepared', 'Transaction prepared. Signing via Privy Expo SDK not yet wired.');
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setIsClosing(false);
          }
        }}
      />
    </GlassCard>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function VestingRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.vestingRow}>
      <Text style={styles.vestingRowLabel}>{label}</Text>
      <Text style={[styles.vestingRowValue, highlight && { color: colors.textPrimary, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function formatTokens(n?: number): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

// ── Main Status Card ───────────────────────────────────────────────────────

export function MarketStatusCard({
  market,
  positionData,
  vestingData,
  walletAddress,
  network,
  onRefresh,
}: MarketStatusCardProps) {
  const resolution = market.resolution ?? 'Unresolved';
  const expired = isExpired(market.expiryTime);
  const poolFull = isPoolFull(market.poolProgressPercentage);
  const yesWinning = getYesWinning(market);
  const inFunding = market.phase === 'Funding';

  // Determine status config
  let statusIcon: keyof typeof Ionicons.glyphMap = 'checkmark-circle-outline';
  let statusTitle = '';
  let statusSubtitle = '';
  let statusColor = colors.success;
  let statusBg = colors.successLight;

  if (resolution === 'YesWins') {
    statusIcon = 'trophy-outline';
    statusTitle = 'YES WINS — Token Launched!';
    statusSubtitle = `$${market.tokenSymbol || 'TOKEN'} is now live!`;
    statusColor = colors.success;
    statusBg = colors.successLight;
  } else if (resolution === 'NoWins') {
    statusIcon = 'close-circle-outline';
    statusTitle = 'NO WINS — Project Failed';
    statusSubtitle = 'NO voters receive proportional SOL rewards.';
    statusColor = colors.danger;
    statusBg = colors.dangerLight;
  } else if (resolution === 'Refund') {
    statusIcon = 'arrow-undo-outline';
    statusTitle = 'REFUND — Market Cancelled';
    statusSubtitle = 'All participants receive full refunds.';
    statusColor = colors.warning;
    statusBg = colors.warningLight;
  } else if (inFunding) {
    statusIcon = 'cash-outline';
    statusTitle = 'Funding Phase — Token Launch Guaranteed!';
    statusSubtitle = 'YES won the vote. Accepting additional contributions.';
    statusColor = colors.success;
    statusBg = colors.successLight;
  } else if (expired) {
    statusIcon = 'time-outline';
    statusTitle = 'Awaiting Resolution';
    statusSubtitle = yesWinning
      ? 'Waiting for founder to launch token...'
      : 'Market expired. Ready for resolution.';
    statusColor = colors.warning;
    statusBg = colors.warningLight;
  } else if (poolFull) {
    statusIcon = 'locate-outline';
    statusTitle = 'Pool Complete — Voting Closed';
    statusSubtitle = `Pool reached target. ${yesWinning ? 'YES' : 'NO'} is winning.`;
    statusColor = '#22d3ee';
    statusBg = 'rgba(34,211,238,0.15)';
  } else {
    statusIcon = 'checkmark-circle-outline';
    statusTitle = 'Active Market';
    statusSubtitle = 'Voting is open.';
    statusColor = colors.success;
    statusBg = colors.successLight;
  }

  return (
    <View style={styles.container}>
      {/* Status header */}
      <GlassCard style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIconWrap, { backgroundColor: statusBg }]}>
            <Ionicons name={statusIcon} size={20} color={statusColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: statusColor }]}>{statusTitle}</Text>
            <Text style={styles.statusSubtitle}>{statusSubtitle}</Text>
          </View>
        </View>

        {/* Phase badge */}
        {resolution === 'Unresolved' && (
          <View style={styles.badgeRow}>
            <View style={[styles.phaseBadge, { backgroundColor: inFunding ? colors.warningLight : 'rgba(129,140,248,0.15)' }]}>
              <Text style={[styles.phaseBadgeText, { color: inFunding ? colors.warning : colors.primary }]}>
                {inFunding ? 'Funding' : 'Prediction'}
              </Text>
            </View>
            {poolFull && (
              <View style={[styles.phaseBadge, { backgroundColor: 'rgba(34,211,238,0.15)' }]}>
                <Text style={[styles.phaseBadgeText, { color: '#22d3ee' }]}>Pool Full</Text>
              </View>
            )}
            {expired && (
              <View style={[styles.phaseBadge, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.phaseBadgeText, { color: colors.warning }]}>Expired</Text>
              </View>
            )}
          </View>
        )}
      </GlassCard>

      {/* Claim section */}
      <ClaimSection
        market={market}
        positionData={positionData}
        walletAddress={walletAddress}
        network={network}
        onRefresh={onRefresh}
      />

      {/* Founder actions */}
      <FounderActions
        market={market}
        walletAddress={walletAddress}
        network={network}
        onRefresh={onRefresh}
      />

      {/* Team vesting (visible to all if initialized, founder can init/claim) */}
      <TeamVestingSection
        market={market}
        vestingData={vestingData}
        walletAddress={walletAddress}
        network={network}
      />

      {/* Founder SOL vesting */}
      <FounderSolVestingSection
        market={market}
        vestingData={vestingData}
        walletAddress={walletAddress}
        network={network}
      />

      {/* Close market */}
      <CloseMarketSection
        market={market}
        walletAddress={walletAddress}
        network={network}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: spacing.md },

  // Status card
  statusCard: { padding: spacing.md, gap: spacing.sm },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusIconWrap: { width: 36, height: 36, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { ...typography.captionBold },
  statusSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  phaseBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  phaseBadgeText: { ...typography.micro, fontWeight: '600' },

  // Action button
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: 14, borderRadius: borderRadius.lg,
  },
  actionBtnText: { ...typography.captionBold },

  // Claimed banner
  claimedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successLight, borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  claimedText: { ...typography.captionBold, color: colors.success },

  // Founder section
  founderSection: { gap: spacing.sm },
  founderTitle: { ...typography.bodyBold, color: colors.textPrimary },
  founderDesc: { ...typography.caption, color: colors.textMuted, lineHeight: 22 },

  // Vesting card
  vestingCard: { padding: spacing.md, gap: spacing.sm },
  vestingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vestingTitle: { ...typography.captionBold, color: colors.warning },
  vestingDesc: { ...typography.caption, color: colors.textMuted, lineHeight: 22 },
  vestingMicro: { ...typography.micro, color: colors.textMuted },
  vestingGrid: { gap: spacing.xs },
  vestingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vestingRowLabel: { ...typography.caption, color: colors.textMuted },
  vestingRowValue: { ...typography.captionBold, color: colors.textSecondary },
  progressTrack: { height: 6, borderRadius: borderRadius.full, backgroundColor: colors.surface, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: borderRadius.full },

  // Close card
  closeCard: { padding: spacing.md, gap: spacing.sm },
  closeTitle: { ...typography.captionBold, color: colors.textMuted },
  closeDesc: { ...typography.micro, color: colors.textMuted, lineHeight: 18 },
});
