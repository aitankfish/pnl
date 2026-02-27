/**
 * Market Detail Screen
 * - Hero header with market info
 * - Tabbed content: Overview / Chart / Chat / Holders
 * - Sticky vote bar at bottom
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

const TABS = ['Overview', 'Chart', 'Chat', 'Holders'];

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('Overview');

  const handleVote = (side: 'YES' | 'NO') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Will integrate with useVoting from @pnl/shared/hooks
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        {/* Market Info */}
        <View style={styles.marketInfo}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText}>Market #{id}</Text>
          </View>
          <Text style={styles.marketTitle}>Loading market...</Text>
          <Text style={styles.marketDesc}>Connect to view market details</Text>
        </View>

        {/* Vote Bar Visualization */}
        <View style={styles.voteVisualization}>
          <View style={styles.voteRow}>
            <Text style={styles.voteLabel}>YES</Text>
            <View style={styles.voteBarContainer}>
              <View style={[styles.yesBar, { width: '50%' }]} />
            </View>
            <Text style={styles.votePercent}>50%</Text>
          </View>
          <View style={styles.voteRow}>
            <Text style={styles.voteLabel}>NO</Text>
            <View style={styles.voteBarContainer}>
              <View style={[styles.noBar, { width: '50%' }]} />
            </View>
            <Text style={styles.votePercent}>50%</Text>
          </View>
        </View>

        {/* Pool Progress */}
        <View style={styles.poolCard}>
          <View style={styles.poolRow}>
            <Text style={styles.poolLabel}>Pool Progress</Text>
            <Text style={styles.poolValue}>0 / 5 SOL</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '0%' }]} />
          </View>
          <View style={styles.poolRow}>
            <Text style={styles.poolLabel}>Time Remaining</Text>
            <Text style={styles.poolValue}>--</Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          <Text style={styles.tabPlaceholder}>
            {activeTab} content will be loaded from @pnl/shared hooks
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Vote Buttons */}
      <View style={styles.voteButtons}>
        <TouchableOpacity
          style={[styles.voteButton, styles.yesButton]}
          onPress={() => handleVote('YES')}
          activeOpacity={0.8}
        >
          <Ionicons name="trending-up" size={20} color="#fff" />
          <Text style={styles.voteButtonText}>Vote YES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voteButton, styles.noButton]}
          onPress={() => handleVote('NO')}
          activeOpacity={0.8}
        >
          <Ionicons name="trending-down" size={20} color="#fff" />
          <Text style={styles.voteButtonText}>Vote NO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },
  shareButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { flex: 1 },
  scrollInner: { paddingBottom: 120 },
  marketInfo: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, marginBottom: spacing.sm,
  },
  categoryText: { ...typography.micro, color: colors.primary },
  marketTitle: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.sm },
  marketDesc: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  voteVisualization: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voteLabel: { ...typography.micro, color: colors.textSecondary, width: 28 },
  voteBarContainer: { flex: 1, height: 24, backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.sm },
  yesBar: { height: '100%', backgroundColor: colors.success, borderRadius: borderRadius.sm },
  noBar: { height: '100%', backgroundColor: colors.danger, borderRadius: borderRadius.sm },
  votePercent: { ...typography.micro, color: colors.textPrimary, width: 36, textAlign: 'right' },
  poolCard: {
    marginHorizontal: spacing.xl, backgroundColor: colors.surface,
    borderRadius: borderRadius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg,
  },
  poolRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  poolLabel: { ...typography.caption, color: colors.textSecondary },
  poolValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: colors.surfaceElevated, borderRadius: 3, marginBottom: spacing.sm },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  tabBar: {
    flexDirection: 'row', marginHorizontal: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.caption, color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  tabContent: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  tabPlaceholder: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  voteButtons: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    paddingBottom: 34,
    backgroundColor: colors.background,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  voteButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 16, borderRadius: borderRadius.lg,
  },
  yesButton: { backgroundColor: colors.success },
  noButton: { backgroundColor: colors.danger },
  voteButtonText: { ...typography.body, color: '#fff', fontWeight: '700' },
});
