'use client';

import React, { useState, useEffect, useTransition, memo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useSolBalance } from '@/lib/hooks/useSolBalance';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { User, Loader2, Sparkles } from 'lucide-react';
import UserInfo from './UserInfo';
import GlobalSearch from './GlobalSearch';
import NotificationDropdown from './NotificationDropdown';
import { SeedIcon, TreeIcon, BloomIcon, BellflowerIcon, BasketIcon, BowMark } from './PlantIcons';
import { InboxNavItem } from './research/InboxNavItem';

interface NavItem {
  id: string;
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: 'new' | 'count';
}

interface SidebarProps {
  currentPage?: string;
}

// Plant-themed navigation — each action is a stage of growth.
//   Plant  → sow an idea (create a market)
//   Browse → wander the market of ideas (active markets)
//   Orchard → visit the ideas that fully grew (launched projects)
const navItems: NavItem[] = [
  { id: 'create', label: 'Plant', href: '/create', Icon: SeedIcon, badge: 'new' },
  { id: 'markets', label: 'Browse', href: '/browse', Icon: TreeIcon },
  { id: 'launched', label: 'Orchard', href: '/launched', Icon: BloomIcon },
  { id: 'ask', label: 'Ask', href: '/ask', Icon: Sparkles, badge: 'new' },
];

function Sidebar({ currentPage }: SidebarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  // Track whether the avatar image failed to load — broken IPFS gateways /
  // 404s otherwise leave the browser rendering raw alt text in the avatar box.
  const [avatarBroken, setAvatarBroken] = useState(false);
  // Hydration guard. The wallet/auth state is only resolved client-side
  // (Privy + wallet provider hydrate after first paint), so the avatar
  // slot would render <Loader2 /> on the server and a different icon on
  // the client → React hydration mismatch on the SVG <path>. We render
  // a deterministic default (<User />) until `mounted` flips, then swap
  // to the real auth-derived icon on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const router = useRouter();
  const { ready, authenticated, primaryWallet } = useWallet();
  const { showAuthModal } = useAuthModal();
  const { displayName, profilePhotoUrl } = useUserProfile();
  const { unreadCount } = useNotifications();

  // Low-balance glow — shared SWR cache with navbar + wallet page, so one
  // in-flight RPC per refresh window is reused across all consumers.
  const { solBalance } = useSolBalance(authenticated ? primaryWallet?.address : null);
  const shouldGlowWallet = solBalance > 0 && solBalance < 0.02;

  // Reset the broken-avatar flag whenever the photo URL changes so a new
  // upload (or a different account) gets a fresh load attempt.
  useEffect(() => {
    setAvatarBroken(false);
  }, [profilePhotoUrl]);

  // Scroll-aware styling — transparent at top, picks up dark backdrop on scroll
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleWalletClick = useCallback(() => {
    if (!ready) return;
    if (!authenticated) {
      showAuthModal();
    } else {
      startTransition(() => {
        router.push('/wallet');
      });
    }
  }, [ready, authenticated, showAuthModal, router, startTransition]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: isScrolled ? 'rgba(10,8,20,0.86)' : 'rgba(10,8,20,0)',
        backdropFilter: isScrolled ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(14px)' : 'none',
        borderBottom: `1px solid ${isScrolled ? 'rgba(244,238,228,0.08)' : 'transparent'}`,
      }}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 sm:h-[64px] flex items-center justify-between gap-3 sm:gap-4">
        {/* ─── Brand mark — wordless drawn bow, aimed right (app-only) ─── */}
        <Link
          href="/launchpad"
          prefetch
          className="flex items-center flex-shrink-0 group transition-opacity hover:opacity-85"
          aria-label="PnL — home"
          title="PnL"
          style={{ color: '#f4eee4' }}
        >
          <BowMark
            className="w-[42px] sm:w-[50px] h-auto transition-transform duration-300 group-hover:translate-x-0.5"
            strokeWidth={1.4}
          />
        </Link>

        {/* ─── Center nav — plant-icon + mono label ─── */}
        <nav className="flex items-center gap-1 sm:gap-3 md:gap-5 lg:gap-7 flex-1 justify-center min-w-0">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            const Icon = item.Icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch
                className="group relative inline-flex items-center gap-2 py-3 px-2 sm:px-1 transition-colors duration-200"
                style={{ color: isActive ? '#e89660' : '#d8cfc0' }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#f4eee4';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#d8cfc0';
                }}
                title={item.label}
              >
                <Icon className="w-[18px] h-[18px] sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="hidden md:inline mono text-[0.64rem] uppercase tracking-[0.26em]">
                  {item.label}
                </span>
                {item.badge === 'new' && (
                  <span
                    className="absolute top-2 right-0 sm:-right-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#e89660', boxShadow: '0 0 6px rgba(232,150,96,0.8)' }}
                  />
                )}
                {/* Active underline */}
                <span
                  className="absolute left-2 right-2 sm:left-1 sm:right-1 bottom-0 h-px transition-opacity"
                  style={{
                    background: '#e89660',
                    opacity: isActive ? 0.8 : 0,
                  }}
                />
              </Link>
            );
          })}

          {/* Divider + search */}
          <span
            className="hidden md:inline-block w-px h-4 mx-1"
            style={{ background: 'rgba(138,127,114,0.3)' }}
          />
          <div className="ml-1 sm:ml-2">
            <GlobalSearch />
          </div>
        </nav>

        {/* ─── Right: notifications, profile info, wallet ─── */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Desktop notifications dropdown */}
          <div
            className="relative hidden lg:block"
            onMouseEnter={() => setIsNotificationDropdownOpen(true)}
            onMouseLeave={() => setIsNotificationDropdownOpen(false)}
          >
            <button
              className="inline-flex items-center justify-center w-9 h-9 transition-colors relative"
              style={{
                color:
                  currentPage === 'notifications' || isNotificationDropdownOpen
                    ? '#e89660'
                    : '#d8cfc0',
              }}
              title="Notifications"
            >
              <BellflowerIcon className="w-[19px] h-[19px]" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center"
                  style={{ background: '#e89660', color: '#0a0814' }}
                >
                  <span className="mono text-[0.5rem] font-bold leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </span>
              )}
            </button>
            <NotificationDropdown
              isOpen={isNotificationDropdownOpen}
              onClose={() => setIsNotificationDropdownOpen(false)}
            />
          </div>

          {/* Mobile notifications link */}
          <Link
            href="/notifications"
            prefetch
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 transition-colors relative"
            style={{ color: currentPage === 'notifications' ? '#e89660' : '#d8cfc0' }}
            title="Notifications"
          >
            <BellflowerIcon className="w-[19px] h-[19px]" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1.5 w-2 h-2 rounded-full"
                style={{ background: '#e89660', boxShadow: '0 0 6px rgba(232,150,96,0.8)' }}
              />
            )}
          </Link>

          {/* Citation inbox — only renders when the connected wallet has
              pending citations. Silent for everyone else. */}
          <InboxNavItem active={currentPage === 'research-inbox'} />

          {/* Merch basket (harvest glyph) — desktop only, subtle */}
          <Link
            href="/merch"
            prefetch
            className="hidden xl:inline-flex items-center justify-center w-9 h-9 transition-colors"
            style={{ color: currentPage === 'merch' ? '#e89660' : '#8a7f72' }}
            onMouseEnter={(e) => {
              if (currentPage !== 'merch') e.currentTarget.style.color = '#f4eee4';
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 'merch') e.currentTarget.style.color = '#8a7f72';
            }}
            title="PNL Merch"
          >
            <BasketIcon className="w-[19px] h-[19px]" />
          </Link>

          {/* User info display (username + balance) */}
          <UserInfo compact className="hidden lg:flex" />

          {/* Wallet button — flat amber block matching landing primary CTA */}
          <button
            onClick={handleWalletClick}
            disabled={isPending}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 transition-all duration-200 cursor-pointer overflow-hidden relative disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: shouldGlowWallet ? '#0a0814' : '#e89660',
              color: shouldGlowWallet ? '#e89660' : '#0a0814',
              border: shouldGlowWallet ? '1px solid rgba(232,150,96,0.6)' : '1px solid transparent',
              animation: shouldGlowWallet ? 'walletLowPulse 1.6s ease-in-out infinite' : undefined,
            }}
            title={
              shouldGlowWallet
                ? `Low Balance: ${solBalance.toFixed(4)} SOL — click to deposit`
                : authenticated
                ? `${displayName} · Wallet`
                : 'Connect Wallet'
            }
          >
            {!mounted ? (
              // SSR + first paint — deterministic, matches server output exactly.
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : isPending ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : authenticated && profilePhotoUrl && !avatarBroken ? (
              <img
                src={profilePhotoUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
            {!authenticated && !isPending && (
              <span
                className="absolute -right-0 -top-0 w-1.5 h-1.5"
                style={{ background: '#0a0814' }}
              />
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes walletLowPulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(232, 150, 96, 0.6), 0 0 20px rgba(232, 150, 96, 0.15);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(232, 150, 96, 0.15), 0 0 30px rgba(232, 150, 96, 0.35);
          }
        }
      `}</style>
    </header>
  );
}

export default memo(Sidebar);
