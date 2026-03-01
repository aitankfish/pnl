/**
 * Notifications Screen
 * Displays user notifications with filter tabs, priority badges, action buttons,
 * project pills, mark-as-read, delete, and pull-to-refresh.
 * Uses mobile AuthProvider directly (shared useNotifications depends on web-only privy).
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { PressableScale, ScreenHeader } from '../../src/components';
import { colors, spacing, borderRadius } from '../../src/theme';

/* ── Types ── */
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
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

/* ── Action button config ── */
function getActionConfig(type: string): { label: string; colors: [string, string] } {
  switch (type) {
    case 'claim_ready':
      return { label: 'Claim Rewards', colors: ['#10b981', '#059669'] };
    case 'token_launched':
      return { label: 'View Token', colors: ['#6366f1', '#8b5cf6'] };
    case 'pool_complete':
      return { label: 'View Market', colors: ['#06b6d4', '#0891b2'] };
    case 'founder_voice_live':
      return { label: 'Join Voice', colors: ['#ef4444', '#dc2626'] };
    default:
      return { label: 'View', colors: ['#06b6d4', '#3b82f6'] };
  }
}

/* ── Single notification row ── */
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
  const action = getActionConfig(item.type);

  const handlePress = useCallback(() => {
    if (!item.isRead) onMarkRead(item.id);
    if (item.actionUrl) router.push(item.actionUrl as any);
  }, [item, onMarkRead]);

  return (
    <Pressable
      style={[styles.row, !item.isRead && styles.rowUnread]}
      onPress={handlePress}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${icon.color}20` }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>

      <View style={styles.rowContent}>
        {/* Title row: title + priority badge + unread dot */}
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

        {/* Message */}
        <Text style={styles.rowMessage} numberOfLines={2}>{item.message}</Text>

        {/* Project pill */}
        {item.project && (
          <View style={styles.projectPill}>
            {item.project.category ? (
              <Text style={styles.projectCategory}>{item.project.category}</Text>
            ) : null}
            <Text style={styles.projectName} numberOfLines={1}>{item.project.name}</Text>
            <Text style={styles.projectSymbol}>${item.project.symbol}</Text>
          </View>
        )}

        {/* Meta row: timestamp + action button */}
        <View style={styles.rowMeta}>
          <Text style={styles.rowTimestamp}>{item.timestamp}</Text>
          {item.actionUrl && (
            <PressableScale
              onPress={handlePress}
              scaleDown={0.95}
              style={styles.actionBtnWrap}
            >
              <LinearGradient
                colors={action.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtn}
              >
                <Text style={styles.actionBtnText}>{action.label}</Text>
                <Ionicons name="chevron-forward" size={12} color="#fff" />
              </LinearGradient>
            </PressableScale>
          )}
        </View>
      </View>

      <Pressable style={styles.deleteBtn} onPress={() => onDelete(item.id)} hitSlop={8}>
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

/* ── Main screen ── */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, walletAddress } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          // Count per filter
          let count = 0;
          if (tab.key === 'all') count = notifications.length;
          else if (tab.key === 'market_resolved') count = notifications.filter(n => n.type === 'market_resolved' || n.type === 'claim_ready').length;
          else if (tab.key === 'token_launched') count = notifications.filter(n => n.type === 'token_launched').length;

          return (
            <PressableScale
              key={tab.key}
              onPress={() => setActiveFilter(tab.key)}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* List */}
      {filteredNotifications.length === 0 ? (
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
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow item={item} onMarkRead={markAsRead} onDelete={deleteNotification} />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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

  // Filter tabs
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: 'rgba(129, 140, 248, 0.5)',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#c4b5fd',
  },
  filterCount: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.25)',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterCountTextActive: {
    color: '#c4b5fd',
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

  // Meta row
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  rowTimestamp: { fontSize: 11, color: colors.textMuted },

  // Action button
  actionBtnWrap: {},
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  deleteBtn: { padding: 4, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.glassBorder, marginLeft: 68 },

  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  signInBtn: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  signInText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
