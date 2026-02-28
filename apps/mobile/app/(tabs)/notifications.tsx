/**
 * Notifications Screen
 * Displays user notifications with mark-as-read, delete, and pull-to-refresh.
 * Uses mobile AuthProvider directly (shared useNotifications depends on web-only privy).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors, spacing } from '../../src/theme';

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
}

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
    priority: raw.priority,
    project: raw.projectId
      ? { name: raw.projectId.name, symbol: raw.projectId.tokenSymbol, category: raw.projectId.category }
      : null,
    actionUrl: raw.actionUrl || null,
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

  return (
    <Pressable
      style={[styles.row, !item.isRead && styles.rowUnread]}
      onPress={() => {
        if (!item.isRead) onMarkRead(item.id);
        if (item.actionUrl) router.push(item.actionUrl as any);
      }}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${icon.color}20` }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.rowMessage} numberOfLines={2}>{item.message}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowTimestamp}>{item.timestamp}</Text>
          {item.project && (
            <Text style={styles.rowProject}>${item.project.symbol}</Text>
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

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sign in to view notifications</Text>
        <Pressable style={styles.signInBtn} onPress={() => router.push('/login')}>
          <Text style={styles.signInText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  // Loading
  if (isLoading && !notifications.length) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={markAllAsRead} hitSlop={8}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      {notifications.length === 0 ? (
        <View style={[styles.center, { flex: 1 }]}>
          <Ionicons name="notifications-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            You'll be notified about votes, launches, and rewards
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
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
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
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
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  rowTimestamp: { fontSize: 11, color: colors.textMuted },
  rowProject: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  deleteBtn: { padding: 4, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.glassBorder, marginLeft: 68 },

  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  signInBtn: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  signInText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
