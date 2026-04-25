import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from './useWallet';
import { useUserSocket } from './useSocket';
import { apiUrl } from '../utils/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  priority: 'high' | 'medium' | 'low';
  project: {
    name: string;
    symbol: string;
    category: string;
  } | null;
  action: string | null;
  actionUrl: string | null;
  metadata?: Record<string, any>;
}

// Helper to format timestamp from Date to relative time
const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
};

// Transform API notification to UI format
const transformNotification = (apiNotification: any): Notification => {
  return {
    id: apiNotification._id,
    type: apiNotification.type,
    title: apiNotification.title,
    message: apiNotification.message,
    timestamp: formatTimestamp(apiNotification.createdAt),
    isRead: apiNotification.isRead,
    priority: apiNotification.priority,
    project: apiNotification.projectId ? {
      name: apiNotification.projectId.name,
      symbol: apiNotification.projectId.tokenSymbol,
      category: apiNotification.projectId.category,
    } : null,
    action: apiNotification.metadata?.action || null,
    actionUrl: apiNotification.actionUrl || null,
    metadata: apiNotification.metadata,
  };
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { authenticated, primaryWallet } = useWallet();

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!authenticated || !primaryWallet?.address) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/notifications?wallet=${primaryWallet.address}`));

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      const transformedNotifications = data.notifications.map(transformNotification);

      setNotifications(transformedNotifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, primaryWallet?.address]);

  // Fetch notifications when wallet changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ─── Real-time bell updates via Socket.IO ───
  // Mirrors the pattern in usePositions — go through useUserSocket so we
  // don't open a second socket connection. The server pushes the raw API
  // notification into the user:{wallet} room; we transform + dedupe + prepend.
  const walletAddress = primaryWallet?.address ?? null;
  const { notifications: socketNotifications } = useUserSocket(walletAddress);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socketNotifications || socketNotifications.length === 0) return;

    // socketNotifications is an array of raw API notifications, newest first.
    // Walk it and prepend any ids we haven't already merged.
    const fresh: Notification[] = [];
    for (const apiNotification of socketNotifications) {
      if (!apiNotification?._id) continue;
      const id = String(apiNotification._id);
      if (seenIdsRef.current.has(id)) continue;
      seenIdsRef.current.add(id);
      fresh.push(transformNotification(apiNotification));
    }
    if (fresh.length === 0) return;

    setNotifications((prev) => {
      // Race-guard against a concurrent fetchNotifications result that already
      // contains the same id.
      const existing = new Set(prev.map((n) => n.id));
      const toPrepend = fresh.filter((n) => !existing.has(n.id));
      if (toPrepend.length === 0) return prev;
      return [...toPrepend, ...prev];
    });
    const unreadDelta = fresh.filter((n) => !n.isRead).length;
    if (unreadDelta > 0) setUnreadCount((prev) => prev + unreadDelta);
  }, [socketNotifications]);

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    if (!authenticated || !primaryWallet?.address) return;

    try {
      const response = await fetch(apiUrl('/api/notifications'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: primaryWallet.address,
          notificationId: id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id
            ? { ...notification, isRead: true }
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!authenticated || !primaryWallet?.address) return;

    try {
      const response = await fetch(apiUrl('/api/notifications'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: primaryWallet.address,
          markAll: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    if (!authenticated || !primaryWallet?.address) return;

    try {
      const response = await fetch(apiUrl('/api/notifications'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: primaryWallet.address,
          notificationId: id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Update local state
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));

      // Update unread count if the deleted notification was unread
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Add notification (for local testing or optimistic updates)
  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `temp-${Date.now()}`,
      timestamp: 'Just now',
    };
    setNotifications(prev => [newNotification, ...prev]);
    if (!notification.isRead) {
      setUnreadCount(prev => prev + 1);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    refreshNotifications: fetchNotifications,
  };
}
