'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { BellflowerIcon, BloomIcon, SeedIcon, BasketIcon, SunIcon, LeafIcon } from './PlantIcons';
import { Check, Trash2, Clock } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Cosmic-plant palette (same tokens used across landing + app) ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.14)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

// Map notification type → plant glyph + accent color. Lucide-icons removed
// in favor of the in-house plant icon set so the dropdown reads as the same
// visual language as the navbar / dashboard.
const typeStyle = (type: string): { Icon: React.ComponentType<{ className?: string }>; tint: string } => {
  switch (type) {
    case 'claim_ready':
      return { Icon: BasketIcon, tint: FOREST };
    case 'token_launched':
      return { Icon: BloomIcon, tint: AMBER };
    case 'market_resolved':
    case 'vote_result':
      return { Icon: SunIcon, tint: PEACH };
    case 'project_update':
      return { Icon: LeafIcon, tint: FOREST };
    case 'community_milestone':
      return { Icon: SeedIcon, tint: AMBER };
    case 'weekly_digest':
      return { Icon: LeafIcon, tint: PEACH };
    default:
      return { Icon: BellflowerIcon, tint: AMBER };
  }
};

export default function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const recentNotifications = notifications.slice(0, 6);

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-80 sm:w-96 z-50"
    >
      <div
        className="overflow-hidden"
        style={{
          background: 'rgba(10,8,20,0.94)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: `1px solid ${HAIR_STRONG}`,
          boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
        }}
      >
        {/* ─── Header ─── */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${HAIR}` }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="mono uppercase tracking-[0.28em] text-[0.62rem]"
              style={{ color: CREAM }}
            >
              Notifications
            </span>
            {unreadCount > 0 && (
              <span
                className="mono text-[0.58rem] uppercase tracking-[0.18em] px-1.5 py-0.5"
                style={{ background: AMBER, color: BG }}
              >
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="mono text-[0.58rem] uppercase tracking-[0.18em] px-2 py-1 transition-colors"
              style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = CREAM;
                e.currentTarget.style.borderColor = 'rgba(232,150,96,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = CREAM_DIM;
                e.currentTarget.style.borderColor = HAIR_STRONG;
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* ─── List ─── */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div
                className="w-5 h-5 mx-auto mb-3 animate-spin"
                style={{
                  border: `1.5px solid ${HAIR_STRONG}`,
                  borderTopColor: AMBER,
                  borderRadius: '50%',
                }}
              />
              <p className="mono text-[0.62rem] uppercase tracking-[0.22em]" style={{ color: CREAM_FAINT }}>
                Listening…
              </p>
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="p-10 text-center">
              <BellflowerIcon className="w-9 h-9 mx-auto mb-3" />
              <p
                className="text-[0.78rem]"
                style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}
              >
                Nothing has bloomed yet.
              </p>
              <p
                className="mono text-[0.55rem] uppercase tracking-[0.22em] mt-1.5"
                style={{ color: CREAM_FAINT }}
              >
                We'll let you know.
              </p>
            </div>
          ) : (
            recentNotifications.map((notification) => {
              const { Icon, tint } = typeStyle(notification.type);
              const handleNotificationClick = () => {
                if (!notification.isRead) markAsRead(notification.id);
                if (notification.actionUrl) onClose();
              };

              const inner = (
                <div className="flex gap-3">
                  {/* Icon tile — flat amber/forest/peach square, square corners */}
                  <div
                    className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${tint}22`,
                      border: `1px solid ${tint}55`,
                      color: tint,
                    }}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p
                            className="text-[0.82rem] truncate"
                            style={{
                              color: CREAM,
                              fontWeight: notification.isRead ? 400 : 600,
                              fontFamily: 'var(--font-fraunces, serif)',
                            }}
                          >
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span
                              className="w-1.5 h-1.5 flex-shrink-0"
                              style={{ background: AMBER, boxShadow: `0 0 6px ${AMBER}` }}
                            />
                          )}
                        </div>
                        <p
                          className="text-[0.7rem] line-clamp-2 leading-snug"
                          style={{ color: CREAM_DIM }}
                        >
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="mono text-[0.55rem] uppercase tracking-[0.2em] flex items-center gap-1"
                            style={{ color: CREAM_FAINT }}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {notification.timestamp}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        className="flex items-center gap-0.5 flex-shrink-0"
                        onClick={(e) => e.preventDefault()}
                      >
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="p-1.5 transition-colors"
                            style={{ color: CREAM_FAINT }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="p-1.5 transition-colors"
                          style={{ color: CREAM_FAINT }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = EARTH)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );

              const baseStyle: React.CSSProperties = {
                background: notification.isRead ? 'transparent' : 'rgba(232,150,96,0.06)',
                borderBottom: `1px solid ${HAIR}`,
                borderLeft: notification.isRead ? '2px solid transparent' : `2px solid ${AMBER}`,
                transition: 'background-color 200ms',
                cursor: notification.actionUrl ? 'pointer' : 'default',
              };

              return notification.actionUrl ? (
                <Link
                  key={notification.id}
                  href={notification.actionUrl}
                  onClick={handleNotificationClick}
                  className="block px-4 py-3"
                  style={baseStyle}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(244,238,228,0.04)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = notification.isRead
                      ? 'transparent'
                      : 'rgba(232,150,96,0.06)')
                  }
                >
                  {inner}
                </Link>
              ) : (
                <div key={notification.id} className="px-4 py-3" style={baseStyle}>
                  {inner}
                </div>
              );
            })
          )}
        </div>

        {/* ─── Footer ─── */}
        {notifications.length > 6 && (
          <div style={{ borderTop: `1px solid ${HAIR}` }} className="p-3">
            <Link
              href="/notifications"
              onClick={onClose}
              className="block w-full text-center py-2.5 mono text-[0.62rem] uppercase tracking-[0.26em] transition-all"
              style={{ background: AMBER, color: BG }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
              onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
            >
              See all {notifications.length}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
