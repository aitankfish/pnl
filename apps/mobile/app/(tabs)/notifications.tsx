/**
 * Notifications Screen
 * Displays user notifications with filter tabs, priority badges, action buttons,
 * project pills, mark-as-read, delete, and pull-to-refresh.
 * Uses mobile AuthProvider directly (shared useNotifications depends on web-only privy).
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { apiUrl } from '@pnl/shared/utils';
import { useUserSocket } from '@pnl/shared/hooks';
import { useAuth } from '../../src/providers/AuthProvider';
import { ScreenHeader, StatusTabs } from '../../src/components';
import type { StatusTab } from '../../src/components/StatusTabs';
import { colors, spacing, borderRadius, editorial } from '../../src/theme';

/* ── Types ── */
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  rawTimestamp: number;
  isRead: boolean;
  priority: 'high' | 'medium' | 'low';
  project: { name: string; symbol: string; category: string } | null;
  actionUrl: string | null;
  metadata?: Record<string, any>;
}

/* ── Filter tabs ── */
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'market_resolved', label: 'Resolved' },
  { key: 'token_launched', label: 'Launched' },
] as const;
type FilterKey = (typeof FILTER_TABS)[number]['key'];

/* ── Helpers ── */
function formatTimestamp(date: any): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function transform(raw: any): Notification {
  return {
    id: raw._id,
    type: raw.type,
    title: raw.title,
    message: raw.message,
    timestamp: formatTimestamp(raw.createdAt),
    rawTimestamp: new Date(raw.createdAt).getTime(),
    isRead: raw.isRead,
    priority: raw.priority || 'medium',
    project: raw.projectId
      ? { name: raw.projectId.name, symbol: raw.projectId.tokenSymbol, category: raw.projectId.category }
      : null,
    actionUrl: raw.actionUrl || null,
    metadata: raw.metadata || null,
  };
}

/* ── Icon map per notification type ── */
const typeIcons: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  claim_ready: { name: 'cash-outline', color: '#10b981' },
  token_launched: { name: 'rocket-outline', color: '#818cf8' },
  market_resolved: { name: 'checkmark-circle-outline', color: '#06b6d4' },
  project_update: { name: 'trending-up-outline', color: '#a78bfa' },
  vote_result: { name: 'checkmark-done-outline', color: '#818cf8' },
  vote_reminder: { name: 'alarm-outline', color: '#f59e0b' },
  reward_earned: { name: 'gift-outline', color: '#10b981' },
  weekly_digest: { name: 'newspaper-outline', color: '#6b7280' },
  community_milestone: { name: 'people-outline', color: '#f59e0b' },
  pool_complete: { name: 'water-outline', color: '#06b6d4' },
  founder_voice_live: { name: 'mic-outline', color: '#ef4444' },
};
const defaultIcon = { name: 'notifications-outline' as keyof typeof Ionicons.glyphMap, color: '#818cf8' };

/* ── Priority config ── */
const priorityConfig: Record<string, { label: string; bg: string; color: string }> = {
  high: { label: 'High', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  medium: { label: 'Med', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  low: { label: 'Low', bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280' },
};

/* ── Swipe action thresholds ── */
const BUTTON_WIDTH = 80;
const SWIPE_FULL = BUTTON_WIDTH * 2;        // both Action + Delete revealed
const SWIPE_DELETE_ONLY = BUTTON_WIDTH;     // only Delete revealed (no action available)

/* ── Action labels per type ── */
// Action-bearing types get specific verbs; everything else with an actionUrl
// falls back to "Open". Notifications with neither type-action nor actionUrl
// only get a Delete swipe.
const ACTION_LABELS: Record<string, string> = {
  claim_ready: 'Claim',
  reward_earned: 'Claim',
  vote_reminder: 'Vote',
  founder_voice_live: 'Join',
  market_resolved: 'View',
  token_launched: 'View',
  pool_complete: 'View',
};

function getPrimaryAction(item: Notification): { label: string } | null {
  if (ACTION_LABELS[item.type]) return { label: ACTION_LABELS[item.type] };
  if (item.actionUrl) return { label: 'Open' };
  return null;
}

/* ── Action-required summary set (drives the "Needs you" header card) ── */
const URGENT_TYPES = new Set([
  'claim_ready',
  'reward_earned',
  'vote_reminder',
  'founder_voice_live',
]);

function summaryLabelFor(type: string): string {
  switch (type) {
    case 'claim_ready':
    case 'reward_earned':
      return 'claims ready';
    case 'vote_reminder':
      return 'votes ending soon';
    case 'founder_voice_live':
      return 'voice rooms live';
    default:
      return type;
  }
}

/* ── Single notification row — swipe left reveals [Action] [Delete] ── */
function NotificationRow({
  item,
  onMarkRead,
  onDelete,
}: {
  item: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const icon = typeIcons[item.type] || defaultIcon;
  const priority = priorityConfig[item.priority];
  const primaryAction = getPrimaryAction(item);
  const swipeDistance = primaryAction ? SWIPE_FULL : SWIPE_DELETE_ONLY;

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const handlePress = useCallback(() => {
    if (!item.isRead) onMarkRead(item.id);
    if (item.actionUrl) router.push(item.actionUrl as any);
  }, [item, onMarkRead]);

  const handleAction = useCallback(() => {
    if (!item.isRead) onMarkRead(item.id);
    if (item.actionUrl) router.push(item.actionUrl as any);
  }, [item, onMarkRead]);

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const newX = startX.value + e.translationX;
      translateX.value = Math.max(Math.min(newX, 0), -swipeDistance - 20);
    })
    .onEnd((e) => {
      if (translateX.value < -swipeDistance / 2 || e.velocityX < -500) {
        translateX.value = withSpring(-swipeDistance, { damping: 20, stiffness: 200 });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (translateX.value < -10) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    } else {
      runOnJS(handlePress)();
    }
  });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -swipeDistance], [0, 1]),
  }));

  return (
    <View style={styles.swipeContainer}>
      {/* Action buttons revealed behind the row */}
      <Reanimated.View style={[styles.swipeActions, actionOpacity]}>
        {primaryAction && (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={handleAction}
          >
            <Ionicons name="arrow-forward-outline" size={18} color={colors.textInverse} />
            <Text style={styles.actionBtnPrimaryText}>{primaryAction.label}</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.actionBtn, styles.actionBtnDelete]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.actionBtnDeleteText}>Delete</Text>
        </Pressable>
      </Reanimated.View>

      <GestureDetector gesture={composedGesture}>
        <Reanimated.View style={[styles.rowSlider, rowAnimStyle]}>
          <View style={[styles.row, !item.isRead && styles.rowUnread]}>
            <View style={[styles.iconCircle, { backgroundColor: `${icon.color}20` }]}>
              <Ionicons name={icon.name} size={20} color={icon.color} />
            </View>

            <View style={styles.rowContent}>
              <View style={styles.rowHeader}>
                <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
                {priority && (
                  <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
                    <Text style={[styles.priorityText, { color: priority.color }]}>
                      {priority.label}
                    </Text>
                  </View>
                )}
                {!item.isRead && <View style={styles.unreadDot} />}
              </View>

              <Text style={styles.rowMessage} numberOfLines={2}>{item.message}</Text>

              {item.project && (
                <View style={styles.projectPill}>
                  {item.project.category ? (
                    <Text style={styles.projectCategory}>{item.project.category}</Text>
                  ) : null}
                  <Text style={styles.projectName} numberOfLines={1}>{item.project.name}</Text>
                  <Text style={styles.projectSymbol}>${item.project.symbol}</Text>
                </View>
              )}

              <Text style={styles.rowTimestamp}>{item.timestamp}</Text>
            </View>
          </View>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

/* ── Main screen ── */
export default function NotificationsScreen() {
  const { isAuthenticated, walletAddress } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // Real-time notifications via Socket.IO
  const { notifications: socketNotifications } = useUserSocket(walletAddress);
  const lastSocketCountRef = useRef(0);

  useEffect(() => {
    if (socketNotifications.length <= lastSocketCountRef.current) return;
    // New notifications arrived via socket — prepend them
    const newOnes = socketNotifications.slice(0, socketNotifications.length - lastSocketCountRef.current);
    lastSocketCountRef.current = socketNotifications.length;

    const transformed = newOnes
      .map((raw: any) => {
        try { return transform(raw); } catch { return null; }
      })
      .filter(Boolean) as Notification[];

    if (transformed.length > 0) {
      setNotifications((prev) => {
        // Deduplicate by id
        const existingIds = new Set(prev.map((n) => n.id));
        const unique = transformed.filter((n) => !existingIds.has(n.id));
        return [...unique, ...prev];
      });
      setUnreadCount((prev) => prev + transformed.length);
    }
  }, [socketNotifications]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !walletAddress) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/notifications?wallet=${walletAddress}`));
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setNotifications(data.notifications.map(transform));
      setUnreadCount(data.unreadCount);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, walletAddress]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications().finally(() => setRefreshing(false));
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!walletAddress) return;
    try {
      await fetch(apiUrl('/api/notifications'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, notificationId: id }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, [walletAddress]);

  const markAllAsRead = useCallback(async () => {
    if (!walletAddress) return;
    try {
      await fetch(apiUrl('/api/notifications'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, markAll: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }, [walletAddress]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!walletAddress) return;
    const wasUnread = notifications.find(n => n.id === id && !n.isRead);
    try {
      await fetch(apiUrl('/api/notifications'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, notificationId: id }),
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, [walletAddress, notifications]);

  // Filter notifications by tab
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    if (activeFilter === 'market_resolved') {
      return notifications.filter(n => n.type === 'market_resolved' || n.type === 'claim_ready');
    }
    if (activeFilter === 'token_launched') {
      return notifications.filter(n => n.type === 'token_launched');
    }
    return notifications;
  }, [notifications, activeFilter]);

  // Build the "Needs you" summary: counts of unread, urgent, action-bearing
  // notifications grouped by type. Only includes types that genuinely need
  // the user to *do* something (claim, vote, join), not informational ones.
  const urgentSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notifications) {
      if (!n.isRead && URGENT_TYPES.has(n.type)) {
        counts[n.type] = (counts[n.type] || 0) + 1;
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  }, [notifications]);

  // Tapping a summary line scrolls to the first matching notification by
  // setting the filter to All and (best-effort) navigating to its actionUrl.
  const handleSummaryTap = useCallback(
    (type: string) => {
      const target = notifications.find((n) => !n.isRead && n.type === type);
      if (target?.actionUrl) {
        if (!target.isRead) markAsRead(target.id);
        router.push(target.actionUrl as any);
      }
    },
    [notifications, markAsRead],
  );

  // Group by time period for SectionList
  const sections = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;
    const groups: Record<string, Notification[]> = { Today: [], Yesterday: [], 'This Week': [], Older: [] };
    for (const n of filteredNotifications) {
      if (n.rawTimestamp >= todayStart) groups.Today.push(n);
      else if (n.rawTimestamp >= yesterdayStart) groups.Yesterday.push(n);
      else if (n.rawTimestamp >= weekStart) groups['This Week'].push(n);
      else groups.Older.push(n);
    }
    return Object.entries(groups)
      .filter(([, data]) => data.length > 0)
      .map(([title, data]) => ({ title, data }));
  }, [filteredNotifications]);

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Alerts" />
        <View style={[styles.centerFill]}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to view notifications</Text>
          <Pressable style={styles.signInBtn} onPress={() => router.push('/login')}>
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading && !notifications.length) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Alerts" />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Alerts"
        right={
          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
            {unreadCount > 0 && (
              <Pressable onPress={markAllAsRead} hitSlop={8}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            )}
          </View>
        }
      />

      {/* Filter tabs */}
      <StatusTabs
        tabs={FILTER_TABS.map((tab): StatusTab => {
          let count = 0;
          if (tab.key === 'all') count = notifications.length;
          else if (tab.key === 'market_resolved') count = notifications.filter(n => n.type === 'market_resolved' || n.type === 'claim_ready').length;
          else if (tab.key === 'token_launched') count = notifications.filter(n => n.type === 'token_launched').length;
          return { value: tab.key, label: count > 0 ? `${tab.label} (${count})` : tab.label };
        })}
        selectedTab={activeFilter}
        onTabChange={(v) => setActiveFilter(v as FilterKey)}
      />

      {/* "Needs you" summary card — only when something actually needs action.
          Cosmic-plant treatment: amber side-rule, italic Fraunces label. */}
      {urgentSummary.total > 0 && (
        <View style={styles.urgentCard}>
          <View style={styles.urgentCardRule} />
          <View style={styles.urgentCardBody}>
            <Text style={styles.urgentCardLabel}>Needs you</Text>
            {Object.entries(urgentSummary.counts).map(([type, count]) => (
              <Pressable
                key={type}
                style={styles.urgentCardLine}
                onPress={() => handleSummaryTap(type)}
                hitSlop={4}
              >
                <Text style={styles.urgentCardCount}>{count}</Text>
                <Text style={styles.urgentCardText}>{summaryLabelFor(type)}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* List */}
      {sections.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="notifications-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {activeFilter === 'all' ? 'No notifications yet' : `No ${FILTER_TABS.find(t => t.key === activeFilter)?.label.toLowerCase()} notifications`}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'all'
              ? "You'll be notified about votes, launches, and rewards"
              : 'Try the "All" tab to see all notifications'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow item={item} onMarkRead={markAsRead} onDelete={deleteNotification} />
          )}
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
              <Text style={styles.sectionHeaderCount}>{data.length}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          stickySectionHeadersEnabled
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBadge: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markAllText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  // Swipe — reveals [primary action] [delete] when actionable, or just
  // [delete] when not. Buttons are full-height and absolute-positioned
  // behind the row.
  swipeContainer: { overflow: 'hidden' },
  swipeActions: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    flexDirection: 'row',
  },
  actionBtn: {
    width: BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary, // amber — conviction action
  },
  actionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textInverse,
  },
  actionBtnDelete: {
    backgroundColor: colors.danger,
  },
  actionBtnDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  rowSlider: { backgroundColor: colors.background },

  // "Needs you" urgent summary card — sits above the list, surfaces
  // counts of action-required unread notifications. Cosmic-plant
  // treatment: amber side-rule + italic Fraunces label.
  urgentCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(232, 150, 96, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(232, 150, 96, 0.12)',
  },
  urgentCardRule: {
    width: 3,
    backgroundColor: colors.primary,
  },
  urgentCardBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 4,
  },
  urgentCardLabel: {
    ...editorial.section,
    color: colors.primary,
    marginBottom: 2,
  },
  urgentCardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  urgentCardCount: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: colors.primary,
    minWidth: 22,
  },
  urgentCardText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 12,
  },
  rowUnread: { backgroundColor: 'rgba(129, 140, 248, 0.06)' },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  rowContent: { flex: 1 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, flex: 1 },
  rowTitleUnread: { fontWeight: '700', color: colors.textPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  rowMessage: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 2 },

  // Priority badge
  priorityBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Project pill
  projectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  projectCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: '#a78bfa',
  },
  projectName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  projectSymbol: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22d3ee',
    fontFamily: 'monospace' as any,
  },

  rowTimestamp: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  separator: { height: 1, backgroundColor: colors.glassBorder, marginLeft: 68 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(10,14,26,0.95)',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  sectionHeaderCount: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  signInBtn: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  signInText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
