'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import {
  BellflowerIcon,
  BloomIcon,
  SeedIcon,
  BasketIcon,
  SunIcon,
  LeafIcon,
} from '@/components/PlantIcons';
import { Check, Trash2, Clock, ExternalLink } from 'lucide-react';

// ── Cosmic-plant palette (shared with NotificationDropdown / Sidebar) ──
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

// Map notification type → plant glyph + accent color (matches dropdown).
const typeStyle = (
  type: string,
): { Icon: React.ComponentType<{ className?: string }>; tint: string } => {
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

const priorityLabel = (p: string) =>
  p === 'high' ? 'urgent' : p === 'medium' ? 'notable' : 'quiet';

export default function NotificationsPage() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();

  const filteredNotifications = notifications.filter((notification) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'market_resolved') {
      return notification.type === 'market_resolved' || notification.type === 'claim_ready';
    }
    return notification.type === selectedFilter;
  });

  const filters = [
    { id: 'all', label: 'All', count: notifications.length },
    {
      id: 'market_resolved',
      label: 'Resolved',
      count: notifications.filter(
        (n) => n.type === 'market_resolved' || n.type === 'claim_ready',
      ).length,
    },
    {
      id: 'token_launched',
      label: 'Bloomed',
      count: notifications.filter((n) => n.type === 'token_launched').length,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* ─── Editorial header ─── */}
      <header className="mb-8 sm:mb-10">
        <p
          className="mono uppercase tracking-[0.3em] text-[0.6rem] mb-2"
          style={{ color: AMBER }}
        >
          The bell
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <h1
            className="text-3xl sm:text-5xl leading-[1.05]"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 350,
              fontFeatureSettings: '"ss01", "ss02"',
            }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <div className="flex items-center gap-3">
              <span
                className="mono text-[0.62rem] uppercase tracking-[0.24em]"
                style={{ color: CREAM_DIM }}
              >
                {unreadCount} unread
              </span>
              <button
                onClick={markAllAsRead}
                className="mono text-[0.6rem] uppercase tracking-[0.24em] px-3 py-2 transition-colors"
                style={{ color: CREAM, border: `1px solid ${HAIR_STRONG}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = AMBER;
                  e.currentTarget.style.color = AMBER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = HAIR_STRONG;
                  e.currentTarget.style.color = CREAM;
                }}
              >
                <Check className="w-3 h-3 inline mr-1.5 -translate-y-px" />
                Mark all read
              </button>
            </div>
          )}
        </div>
        <p
          className="mt-3 text-sm sm:text-base max-w-prose"
          style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}
        >
          What's grown, what's been resolved, what's calling for your attention — gathered here.
        </p>
      </header>

      {/* ─── Filter chips ─── */}
      <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
        {filters.map((f) => {
          const active = selectedFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className="mono text-[0.6rem] uppercase tracking-[0.22em] px-3 py-2 inline-flex items-center gap-2 transition-colors"
              style={{
                background: active ? AMBER : 'transparent',
                color: active ? BG : CREAM_DIM,
                border: `1px solid ${active ? AMBER : HAIR_STRONG}`,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = CREAM;
                  e.currentTarget.style.borderColor = 'rgba(232,150,96,0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = CREAM_DIM;
                  e.currentTarget.style.borderColor = HAIR_STRONG;
                }
              }}
            >
              {f.label}
              {f.count > 0 && (
                <span
                  className="text-[0.55rem] px-1 py-0.5"
                  style={{
                    background: active ? 'rgba(10,8,20,0.18)' : HAIR_STRONG,
                    color: active ? BG : CREAM_DIM,
                  }}
                >
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── List ─── */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div
            className="p-12 text-center"
            style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
          >
            <BellflowerIcon className="w-12 h-12 mx-auto mb-4" />
            <h3
              className="text-xl mb-2"
              style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontWeight: 350 }}
            >
              Nothing has bloomed yet.
            </h3>
            <p
              className="mono text-[0.6rem] uppercase tracking-[0.22em]"
              style={{ color: CREAM_FAINT }}
            >
              {selectedFilter === 'all'
                ? "We'll let you know when something happens."
                : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const { Icon, tint } = typeStyle(notification.type);
            const unread = !notification.isRead;
            return (
              <article
                key={notification.id}
                className="p-4 sm:p-5 transition-colors"
                style={{
                  background: unread ? 'rgba(232,150,96,0.06)' : 'rgba(244,238,228,0.02)',
                  border: `1px solid ${unread ? 'rgba(232,150,96,0.18)' : HAIR}`,
                  borderLeft: `2px solid ${unread ? AMBER : 'transparent'}`,
                }}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Plant tile */}
                  <div
                    className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${tint}22`,
                      border: `1px solid ${tint}55`,
                      color: tint,
                    }}
                  >
                    <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3
                        className="text-base sm:text-lg leading-snug"
                        style={{
                          color: CREAM,
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontWeight: unread ? 500 : 400,
                        }}
                      >
                        {notification.title}
                      </h3>
                      {unread && (
                        <span
                          className="w-1.5 h-1.5 flex-shrink-0"
                          style={{ background: AMBER, boxShadow: `0 0 6px ${AMBER}` }}
                        />
                      )}
                      <span
                        className="mono text-[0.55rem] uppercase tracking-[0.22em] px-1.5 py-0.5"
                        style={{
                          color: tint,
                          border: `1px solid ${tint}66`,
                        }}
                      >
                        {priorityLabel(notification.priority)}
                      </span>
                    </div>

                    {/* Message */}
                    <p
                      className="text-sm leading-relaxed mb-2"
                      style={{ color: CREAM_DIM }}
                    >
                      {notification.message}
                    </p>

                    {/* Project meta */}
                    {notification.project && (
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span
                          className="mono text-[0.55rem] uppercase tracking-[0.22em] px-1.5 py-0.5"
                          style={{
                            color: CREAM_DIM,
                            border: `1px solid ${HAIR_STRONG}`,
                          }}
                        >
                          {notification.project.category}
                        </span>
                        <span
                          className="text-xs sm:text-sm"
                          style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}
                        >
                          {notification.project.name}
                          <span className="mono ml-1.5 text-[0.62rem] tracking-[0.12em]" style={{ color: CREAM_FAINT }}>
                            ({notification.project.symbol})
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Footer row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span
                        className="mono text-[0.55rem] uppercase tracking-[0.22em] inline-flex items-center gap-1.5"
                        style={{ color: CREAM_FAINT }}
                      >
                        <Clock className="w-3 h-3" />
                        {notification.timestamp}
                      </span>

                      <div className="flex items-center gap-2 flex-wrap">
                        {notification.action && notification.actionUrl && (
                          <Link
                            href={notification.actionUrl}
                            className="mono text-[0.6rem] uppercase tracking-[0.22em] px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors"
                            style={{ background: AMBER, color: BG }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {notification.action.replace(/_/g, ' ')}
                          </Link>
                        )}
                        {unread && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1.5 transition-colors"
                            style={{ color: CREAM_FAINT }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1.5 transition-colors"
                          style={{ color: CREAM_FAINT }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = EARTH)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
