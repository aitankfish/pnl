'use client';

import React, { useState, useEffect, useTransition, useMemo, memo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthModal } from '@/contexts/AuthModalContext';
import {
  Plus,
  Target,
  Rocket,
  Bell,
  User,
  Loader2,
  ShoppingBag,
} from 'lucide-react';
import UserInfo from './UserInfo';
import GlobalSearch from './GlobalSearch';
import NotificationDropdown from './NotificationDropdown';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  badge?: string;
  isActive?: boolean;
}

interface SidebarProps {
  currentPage?: string;
}

const sidebarItems: SidebarItem[] = [
  { id: 'create', label: 'Create Project', icon: Plus, href: '/create', badge: 'New' },
  { id: 'markets', label: 'Browse Markets', icon: Target, href: '/browse' },
  { id: 'launched', label: 'Launched Projects', icon: Rocket, href: '/launched' },
  { id: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications' },
];

function Sidebar({ currentPage }: SidebarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [shouldGlowWallet, setShouldGlowWallet] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const router = useRouter();
  const { ready, authenticated, primaryWallet } = useWallet();
  const { showAuthModal } = useAuthModal();
  const { displayName, profilePhotoUrl } = useUserProfile();
  const { unreadCount } = useNotifications();

  useEffect(() => {
    const checkBalance = async () => {
      if (!primaryWallet?.address || !authenticated) {
        setShouldGlowWallet(false);
        return;
      }
      try {
        const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
        const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
        const rpcEndpoint = network === 'mainnet-beta'
          ? process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC
          : process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC;
        const connection = new Connection(rpcEndpoint!, 'confirmed');
        const publicKey = new PublicKey(primaryWallet.address);
        const balance = await connection.getBalance(publicKey);
        const balanceInSOL = balance / LAMPORTS_PER_SOL;
        setWalletBalance(balanceInSOL);
        setShouldGlowWallet(balanceInSOL < 0.02);
      } catch (error) {
        console.error('Error fetching balance for glow effect:', error);
        setShouldGlowWallet(false);
      }
    };
    checkBalance();
    const interval = setInterval(checkBalance, 30000);
    return () => clearInterval(interval);
  }, [primaryWallet, authenticated]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY < lastScrollY) {
            setIsVisible(true);
          } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
            setIsVisible(false);
          }
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

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
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-6xl px-1 sm:px-4 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-20'
      }`}
    >
      <div
        className="p-1.5 sm:p-4 relative overflow-visible"
        style={{
          background: 'rgba(10,8,20,0.78)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(244,238,228,0.08)',
        }}
      >
        {/* Warm amber cosmic specks in the bar backdrop */}
        <div className="absolute inset-0 opacity-30 overflow-hidden pointer-events-none">
          <div className="absolute top-2 left-8 w-[3px] h-[3px] rounded-full animate-pulse" style={{ background: '#ffd7a8' }} />
          <div className="absolute top-3 right-12 w-[2px] h-[2px] rounded-full animate-pulse" style={{ background: '#e89660', animationDelay: '1s' }} />
          <div className="absolute top-4 left-1/3 w-[2px] h-[2px] rounded-full animate-pulse" style={{ background: '#ecb48a', animationDelay: '2s' }} />
          <div className="absolute top-2 right-1/4 w-[3px] h-[3px] rounded-full animate-pulse" style={{ background: '#fff5e1', animationDelay: '0.5s' }} />
          <div className="absolute top-3 left-2/3 w-[2px] h-[2px] rounded-full animate-pulse" style={{ background: '#ffa366', animationDelay: '1.5s' }} />
        </div>

        <div className="flex items-center justify-between gap-1 sm:gap-0 relative z-10">
          {/* Logo — matches landing PnL wordmark */}
          <div className="flex items-center flex-shrink-0">
            <Link href="/launchpad" prefetch className="flex items-baseline gap-2.5 hover:opacity-90 transition-opacity mr-1 sm:mr-5 group">
              <span
                className="serif text-[1.2rem] sm:text-[1.5rem] leading-none tracking-[-0.02em]"
                style={{
                  color: '#f4eee4',
                  fontWeight: 500,
                  fontVariationSettings: "'SOFT' 30, 'WONK' 0, 'opsz' 48",
                }}
              >
                P
                <span
                  className="italic"
                  style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1, 'opsz' 48" }}
                >
                  n
                </span>
                L
              </span>
              <span
                className="hidden sm:inline mono text-[0.54rem] uppercase tracking-[0.26em] px-1.5 py-0.5"
                style={{ color: '#e89660', border: '1px solid rgba(232,150,96,0.35)' }}
              >
                Beta
              </span>
            </Link>
          </div>

          {/* Navigation Icons */}
          <nav className="flex items-center space-x-1 sm:space-x-2 flex-shrink min-w-0">
            {sidebarItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              const showNotificationBadge = item.id === 'notifications' && unreadCount > 0;
              const showNewBadge = item.badge === 'New';
              const isNotification = item.id === 'notifications';

              const baseClasses =
                'flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 transition-all duration-200 group relative flex-shrink-0';
              const activeStyle = isActive
                ? {
                    background: 'rgba(232,150,96,0.12)',
                    color: '#e89660',
                    border: '1px solid rgba(232,150,96,0.35)',
                  }
                : {
                    background: 'transparent',
                    color: '#d8cfc0',
                    border: '1px solid transparent',
                  };
              const hoverClasses = isActive ? '' : 'hover:text-[#f4eee4]';

              if (isNotification) {
                return (
                  <React.Fragment key={item.id}>
                    {/* Mobile: direct link */}
                    <Link
                      href="/notifications"
                      prefetch
                      className={`lg:hidden ${baseClasses} ${hoverClasses}`}
                      style={activeStyle}
                      title={item.label}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      {showNotificationBadge && (
                        <div
                          className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center"
                          style={{ background: '#d67347', color: '#0a0814' }}
                        >
                          <span className="mono text-[0.56rem] font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        </div>
                      )}
                    </Link>

                    {/* Desktop: dropdown on hover */}
                    <div
                      className="hidden lg:block relative"
                      onMouseEnter={() => setIsNotificationDropdownOpen(true)}
                      onMouseLeave={() => setIsNotificationDropdownOpen(false)}
                    >
                      <button
                        className={`${baseClasses} ${hoverClasses}`}
                        style={
                          isActive || isNotificationDropdownOpen
                            ? {
                                background: 'rgba(232,150,96,0.12)',
                                color: '#e89660',
                                border: '1px solid rgba(232,150,96,0.35)',
                              }
                            : activeStyle
                        }
                        title={item.label}
                      >
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        {showNotificationBadge && (
                          <div
                            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center"
                            style={{ background: '#d67347', color: '#0a0814' }}
                          >
                            <span className="mono text-[0.56rem] font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                          </div>
                        )}
                      </button>
                      <NotificationDropdown
                        isOpen={isNotificationDropdownOpen}
                        onClose={() => setIsNotificationDropdownOpen(false)}
                      />
                    </div>
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={item.id}>
                  <Link
                    href={item.href || '#'}
                    prefetch
                    className={`${baseClasses} ${hoverClasses}`}
                    style={activeStyle}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    {showNewBadge && (
                      <span
                        className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full"
                        style={{ background: '#e89660', boxShadow: '0 0 6px rgba(232,150,96,0.8)' }}
                      />
                    )}
                  </Link>
                  {/* GlobalSearch between Markets and Launched */}
                  {index === 1 && <GlobalSearch />}
                </React.Fragment>
              );
            })}
          </nav>

          {/* User + wallet */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <UserInfo compact className="hidden lg:flex" />

            {/* Merch link — now a subtle tile */}
            <Link
              href="/merch"
              prefetch
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 transition-all duration-200 group relative flex-shrink-0"
              style={
                currentPage === 'merch'
                  ? {
                      background: 'rgba(232,150,96,0.12)',
                      color: '#e89660',
                      border: '1px solid rgba(232,150,96,0.35)',
                    }
                  : {
                      background: 'transparent',
                      color: '#d8cfc0',
                      border: '1px solid rgba(244,238,228,0.08)',
                    }
              }
              title="PNL Merch Shop"
            >
              <ShoppingBag className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            </Link>

            {/* Wallet button — flat amber block, matches landing primary CTA */}
            <button
              onClick={handleWalletClick}
              disabled={isPending}
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 transition-all duration-200 cursor-pointer overflow-hidden relative group disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                background: shouldGlowWallet ? '#0a0814' : '#e89660',
                color: shouldGlowWallet ? '#e89660' : '#0a0814',
                border: shouldGlowWallet ? '1px solid rgba(232,150,96,0.6)' : '1px solid transparent',
                animation: shouldGlowWallet ? 'walletLowPulse 1.6s ease-in-out infinite' : undefined,
              }}
              title={
                shouldGlowWallet
                  ? `Low Balance: ${(Number(walletBalance) || 0).toFixed(4)} SOL — click to deposit`
                  : authenticated
                  ? `${displayName} · Wallet & Profile`
                  : 'Connect Wallet'
              }
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : authenticated && profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              {/* Accent corner matching landing CTA style */}
              {!authenticated && !isPending && (
                <span className="absolute -right-0 -top-0 w-1.5 h-1.5" style={{ background: '#0a0814' }} />
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes walletLowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,150,96,0.6), 0 0 20px rgba(232,150,96,0.15); }
          50%      { box-shadow: 0 0 0 4px rgba(232,150,96,0.15), 0 0 30px rgba(232,150,96,0.35); }
        }
      `}</style>
    </div>
  );
}

export default memo(Sidebar);
