/**
 * Profile Tab — Portfolio, positions, settings, create CTA
 * Combines old Profile + Portfolio + Create entry point
 */

import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  ScreenHeader,
  PressableScale,
  GlassCard,
  SectionHeader,
  EmptyState,
} from '../../src/components';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, walletAddress, logout } = useAuth();

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

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Profile"
        right={
          isAuthenticated ? (
            <PressableScale onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
            </PressableScale>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}>
        {/* Section 1: User Info */}
        {isAuthenticated ? (
          <View style={styles.userSection}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={32} color={colors.textMuted} />
              </View>
            </View>
            <Text style={styles.displayName}>
              {(user as any)?.email?.address || 'PNL User'}
            </Text>
            {walletAddress && (
              <PressableScale onPress={handleCopyAddress} style={styles.addressRow}>
                <Text style={styles.address}>{truncateAddress(walletAddress)}</Text>
                <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
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
              <Text style={styles.portfolioLabel}>Total Value</Text>
              <Text style={styles.portfolioValue}>--.- SOL</Text>
              <Text style={styles.portfolioUsd}>$--.--</Text>
              <View style={styles.quickActions}>
                <PressableScale style={styles.quickAction}>
                  <Ionicons name="arrow-down-outline" size={18} color={colors.primary} />
                  <Text style={styles.quickActionText}>Deposit</Text>
                </PressableScale>
                <PressableScale style={styles.quickAction}>
                  <Ionicons name="arrow-up-outline" size={18} color={colors.primary} />
                  <Text style={styles.quickActionText}>Withdraw</Text>
                </PressableScale>
                <PressableScale style={styles.quickAction}>
                  <Ionicons name="gift-outline" size={18} color={colors.primary} />
                  <Text style={styles.quickActionText}>Claim</Text>
                </PressableScale>
              </View>
            </GlassCard>

            {/* Section 3: Active Positions */}
            <SectionHeader title="Active Positions" count={0} />
            <EmptyState
              icon="bar-chart-outline"
              title="No positions yet"
              subtitle="Vote on markets to start building your portfolio"
              actionLabel="Browse Markets"
              onAction={() => router.push('/(tabs)/explore')}
            />
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
          <SettingsRow icon="wallet-outline" label="Connected Wallets" />
          <SettingsRow icon="notifications-outline" label="Notifications" />
          <SettingsRow icon="help-circle-outline" label="Help & Support" />
          <SettingsRow icon="information-circle-outline" label="About PNL" />
        </View>
      </ScrollView>
    </View>
  );
}

function SettingsRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <PressableScale style={styles.settingsRow}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={styles.settingsLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    ...typography.title,
    color: colors.textPrimary,
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
  },
  portfolioUsd: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
    gap: 4,
  },
  quickActionText: {
    ...typography.micro,
    color: colors.textSecondary,
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
});
