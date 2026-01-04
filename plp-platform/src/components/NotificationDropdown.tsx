'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import {
  Bell,
  CheckCircle,
  Rocket,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  Check,
  Trash2,
  ExternalLink
} from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      // Delay to prevent immediate close on the same click that opened it
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'claim_ready': return <DollarSign className="w-4 h-4" />;
      case 'token_launched': return <Rocket className="w-4 h-4" />;
      case 'market_resolved': return <CheckCircle className="w-4 h-4" />;
      case 'project_update': return <TrendingUp className="w-4 h-4" />;
      case 'vote_result': return <CheckCircle className="w-4 h-4" />;
      case 'weekly_digest': return <Bell className="w-4 h-4" />;
      case 'community_milestone': return <Users className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === 'high') {
      switch (type) {
        case 'claim_ready': return 'from-green-500 to-emerald-500';
        case 'token_launched': return 'from-blue-500 to-purple-500';
        case 'market_resolved': return 'from-cyan-500 to-blue-500';
        case 'community_milestone': return 'from-yellow-500 to-orange-500';
        default: return 'from-purple-500 to-pink-500';
      }
    }
    if (priority === 'medium') {
      switch (type) {
        case 'claim_ready': return 'from-green-400 to-emerald-400';
        case 'market_resolved': return 'from-blue-400 to-cyan-400';
        case 'project_update': return 'from-purple-400 to-pink-400';
        default: return 'from-blue-500 to-cyan-500';
      }
    }
    return 'from-gray-500 to-gray-600';
  };

  if (!isOpen) return null;

  // Show only the 6 most recent notifications in dropdown
  const recentNotifications = notifications.slice(0, 6);

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-white/50 text-sm">Loading...</p>
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-10 h-10 text-white/20 mx-auto mb-2" />
            <p className="text-white/50 text-sm">No notifications yet</p>
          </div>
        ) : (
          recentNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                !notification.isRead ? 'bg-white/5' : ''
              }`}
            >
              <div className="flex gap-3">
                {/* Icon */}
                <div className={`w-8 h-8 bg-gradient-to-r ${getNotificationColor(notification.type, notification.priority)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm truncate ${!notification.isRead ? 'text-white font-medium' : 'text-white/80'}`}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                        )}
                      </div>
                      <p className="text-xs text-white/50 line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-white/40 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {notification.timestamp}
                        </span>
                        {notification.actionUrl && (
                          <Link
                            href={notification.actionUrl}
                            onClick={onClose}
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center"
                          >
                            View <ExternalLink className="w-3 h-3 ml-0.5" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <Link
          href="/notifications"
          onClick={onClose}
          className="block w-full text-center py-2 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-white/5 rounded-lg transition-colors"
        >
          See all notifications
        </Link>
      </div>
    </div>
  );
}
