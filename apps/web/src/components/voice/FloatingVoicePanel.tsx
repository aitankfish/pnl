'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { Mic, MicOff, PhoneOff, Users, Minimize2, Wifi, WifiOff } from 'lucide-react';
import { useVoiceRoomContextSafe } from '@/lib/context/VoiceRoomContext';
import { useWallet } from '@/hooks/useWallet';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { BellflowerIcon } from '@/components/PlantIcons';

// ── Cosmic-plant palette ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

// Dynamically import CommunityHub to avoid circular dependencies
const CommunityHub = dynamic(() => import('@/components/chat/CommunityHub'), {
  loading: () => (
    <div
      className="h-full animate-pulse"
      style={{ background: 'rgba(244,238,228,0.025)' }}
    />
  ),
  ssr: false,
});

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

interface MarketData {
  name?: string;
  founderWallet?: string;
  marketAddress?: string;
  metadata?: {
    socialLinks?: {
      twitter?: string;
      discord?: string;
      telegram?: string;
      linkedin?: string;
    };
  };
}

export default function FloatingVoicePanel() {
  const voiceRoom = useVoiceRoomContextSafe();
  const pathname = usePathname();
  const params = useParams();
  const { primaryWallet } = useWallet();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Drag-to-dismiss gesture handling
  const touchStartY = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Threshold for dismissing (in pixels)
  const DISMISS_THRESHOLD = 150;

  // Market page sidebar drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Allow drag from the top 120px (header + drag zone) for easier swipe-to-dismiss
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const touchYInElement = touch.clientY - rect.top;

    if (touchYInElement <= 120) {
      touchStartY.current = touch.clientY;
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only allow dragging down (positive deltaY)
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    if (dragOffset > DISMISS_THRESHOLD) {
      // Dismiss with animation
      setIsClosing(true);
      setTimeout(() => {
        setIsMobileSidebarOpen(false);
        setDragOffset(0);
        setIsClosing(false);
      }, 200);
    } else {
      // Snap back
      setDragOffset(0);
    }
  }, [isDragging, dragOffset]);

  // Expanded view drag handlers
  const handleExpandedTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const touchYInElement = touch.clientY - rect.top;

    // Allow drag from the top 120px for easier swipe-to-dismiss
    if (touchYInElement <= 120) {
      touchStartY.current = touch.clientY;
      setIsDragging(true);
    }
  }, []);

  const handleExpandedTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  }, [isDragging]);

  const handleExpandedTouchEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    if (dragOffset > DISMISS_THRESHOLD) {
      setIsClosing(true);
      setTimeout(() => {
        setIsExpanded(false);
        setDragOffset(0);
        setIsClosing(false);
      }, 200);
    } else {
      setDragOffset(0);
    }
  }, [isDragging, dragOffset]);

  // Check if we're on a market page
  const isOnMarketPage = pathname?.startsWith('/market/');
  const currentMarketId = params?.id as string | undefined;

  // Fetch market data when on market page
  const { data: marketResponse } = useSWR<{ success: boolean; data: MarketData }>(
    isOnMarketPage && currentMarketId ? `/api/markets/${currentMarketId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const marketData = marketResponse?.data;

  // Track desktop/mobile state
  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // Extract voice room values safely
  const isConnected = voiceRoom?.isConnected ?? false;
  const voiceMarketId = voiceRoom?.marketId ?? null;
  const voiceMarketAddress = voiceRoom?.marketAddress ?? null;
  const voiceMarketName = voiceRoom?.marketName ?? '';
  const participants = voiceRoom?.participants ?? [];
  const isMuted = voiceRoom?.isMuted ?? true;
  const roomTitle = voiceRoom?.roomTitle ?? '';

  // Check if connected to voice for THIS market (or any market if not on market page)
  const isConnectedToCurrentMarket = isConnected &&
    currentMarketId &&
    (voiceMarketId?.toLowerCase() === currentMarketId.toLowerCase() ||
     voiceMarketAddress?.toLowerCase() === currentMarketId.toLowerCase());

  const isConnectedToOtherMarket = isConnected && !isConnectedToCurrentMarket;

  // On market page: always show the CommunityHub (expanded on desktop, button on mobile)
  // On other pages: only show if connected to voice
  if (!isOnMarketPage && !isConnected) {
    return null;
  }

  const totalParticipants = participants.length + 1;
  const walletAddress = primaryWallet?.address ?? voiceRoom?.walletAddress ?? null;

  // Determine which market to show CommunityHub for
  const displayMarketId = isOnMarketPage ? currentMarketId : voiceMarketId;
  const displayMarketAddress = isOnMarketPage ? currentMarketId : voiceMarketAddress;
  const displayMarketName = isOnMarketPage ? '' : voiceMarketName; // Will be fetched by CommunityHub

  // ===========================================
  // CASE 1: On Market Page - Show CommunityHub directly
  // ===========================================
  if (isOnMarketPage && currentMarketId) {
    const socialLinks = marketData?.metadata?.socialLinks ? {
      twitter: marketData.metadata.socialLinks.twitter,
      discord: marketData.metadata.socialLinks.discord,
      telegram: marketData.metadata.socialLinks.telegram,
      linkedin: marketData.metadata.socialLinks.linkedin,
    } : undefined;

    return (
      <>
        {/* Desktop: Fixed right sidebar */}
        <div className="hidden lg:block fixed top-[6.5rem] right-4 w-[28%] min-w-[320px] max-w-[400px] z-30">
          <CommunityHub
            marketId={currentMarketId}
            marketAddress={marketData?.marketAddress || currentMarketId}
            marketName={marketData?.name || ''}
            walletAddress={walletAddress}
            founderWallet={marketData?.founderWallet || null}
            hasPosition={true}
            socialLinks={socialLinks}
            className="h-[calc(100vh-7.5rem)]"
          />
        </div>

        {/* Mobile: floating bellflower entry + sidebar */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-40 p-3.5 transition-all hover:scale-105"
          style={{
            background: AMBER,
            color: BG,
            boxShadow: '0 12px 32px rgba(232,150,96,0.35)',
          }}
          aria-label="Open community"
          title="Community"
        >
          <BellflowerIcon className="w-5 h-5" />
        </button>

        {/* Mobile sidebar */}
        {isMobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0"
              style={{
                background: 'rgba(10,8,20,0.7)',
                backdropFilter: 'blur(6px)',
                opacity: isClosing ? 0 : Math.max(0, 1 - dragOffset / 300),
              }}
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div
              ref={sidebarRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="absolute right-0 top-16 bottom-0 w-full max-w-md animate-in slide-in-from-right duration-300 flex flex-col"
              style={{
                background: BG,
                borderLeft: `1px solid ${HAIR_STRONG}`,
                boxShadow: '0 -10px 50px rgba(0,0,0,0.6)',
                transform: `translateY(${isClosing ? '100%' : `${dragOffset}px`})`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              }}
            >
              <div className="touch-none select-none">
                <div className="flex justify-center pt-3 pb-2">
                  <div
                    className="w-12 h-1 transition-all duration-200"
                    style={{
                      background:
                        dragOffset > DISMISS_THRESHOLD
                          ? FOREST
                          : isDragging
                          ? CREAM_DIM
                          : HAIR_STRONG,
                      transform: isDragging ? 'scaleX(1.2)' : 'scaleX(1)',
                    }}
                  />
                </div>
                {isDragging && (
                  <div className="text-center pb-1">
                    <span
                      className="mono uppercase tracking-[0.22em] text-[0.55rem] transition-colors"
                      style={{
                        color:
                          dragOffset > DISMISS_THRESHOLD ? FOREST : CREAM_FAINT,
                      }}
                    >
                      {dragOffset > DISMISS_THRESHOLD
                        ? 'Release to close'
                        : 'Swipe down to close'}
                    </span>
                  </div>
                )}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: `1px solid ${HAIR}` }}
                >
                  <h2
                    className="truncate flex-1 mr-2"
                    style={{
                      color: CREAM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontSize: '1rem',
                      fontWeight: 350,
                    }}
                  >
                    {marketData?.name || 'Community'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5" style={{ color: FOREST }} />
                    <button
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="p-1.5 transition-colors"
                      style={{ color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <CommunityHub
                  marketId={currentMarketId}
                  marketAddress={marketData?.marketAddress || currentMarketId}
                  marketName={marketData?.name || ''}
                  walletAddress={walletAddress}
                  founderWallet={marketData?.founderWallet || null}
                  hasPosition={true}
                  socialLinks={socialLinks}
                  className="h-full rounded-none border-0"
                  onMinimize={() => setIsMobileSidebarOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ===========================================
  // CASE 2: Not on market page, but connected to voice - Show floating bar
  // ===========================================
  if (!isConnected || !voiceRoom) {
    return null;
  }

  // Minimized bar — cosmic pill
  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
        <div
          className="overflow-hidden"
          style={{
            background: 'rgba(10,8,20,0.94)',
            border: `1px solid ${HAIR_STRONG}`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span
              className="w-1.5 h-1.5 flex-shrink-0"
              style={{
                background: FOREST,
                boxShadow: `0 0 6px ${FOREST}`,
                animation: 'beatPill 1.4s ease-in-out infinite',
              }}
              aria-hidden
            />
            <button
              onClick={() => setIsExpanded(true)}
              className="min-w-0 flex-1 text-left"
            >
              <p
                className="truncate"
                style={{
                  color: CREAM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '0.92rem',
                }}
              >
                {roomTitle || voiceMarketName || 'Voice circle'}
              </p>
            </button>
            <div
              className="flex items-center gap-1 mono uppercase tracking-[0.22em] text-[0.55rem] flex-shrink-0"
              style={{ color: CREAM_FAINT }}
            >
              <Users className="w-3 h-3" />
              {totalParticipants}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => voiceRoom.toggleMute()}
                className="p-1.5 transition-colors"
                style={{
                  background: isMuted ? 'transparent' : FOREST,
                  color: isMuted ? CREAM_DIM : CREAM,
                  border: `1px solid ${isMuted ? HAIR_STRONG : FOREST}`,
                }}
                onMouseEnter={(e) => {
                  if (isMuted) {
                    e.currentTarget.style.color = CREAM;
                    e.currentTarget.style.borderColor = AMBER + '88';
                  } else {
                    e.currentTarget.style.background = '#4a8d4d';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isMuted) {
                    e.currentTarget.style.color = CREAM_DIM;
                    e.currentTarget.style.borderColor = HAIR_STRONG;
                  } else {
                    e.currentTarget.style.background = FOREST;
                  }
                }}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => voiceRoom.leave()}
                className="p-1.5 transition-colors"
                style={{ color: EARTH, border: `1px solid ${EARTH}55` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${EARTH}11`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Leave"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes beatPill {
            0%, 100% { transform: scale(0.85); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // Expanded view - floating panel for voice room from another market
  return (
    <>
      {/* Mobile: full-screen slide-in panel */}
      <div className="lg:hidden fixed inset-0 z-50">
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(10,8,20,0.7)',
            backdropFilter: 'blur(6px)',
            opacity: isClosing ? 0 : Math.max(0, 1 - dragOffset / 300),
          }}
          onClick={() => setIsExpanded(false)}
        />
        <div
          onTouchStart={handleExpandedTouchStart}
          onTouchMove={handleExpandedTouchMove}
          onTouchEnd={handleExpandedTouchEnd}
          className="absolute right-0 top-16 bottom-0 w-full max-w-md animate-in slide-in-from-right duration-300 flex flex-col"
          style={{
            background: BG,
            borderLeft: `1px solid ${HAIR_STRONG}`,
            boxShadow: '0 -10px 50px rgba(0,0,0,0.6)',
            transform: `translateY(${isClosing ? '100%' : `${dragOffset}px`})`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <div className="touch-none select-none">
            <div className="flex justify-center pt-3 pb-2">
              <div
                className="w-12 h-1 transition-all duration-200"
                style={{
                  background:
                    dragOffset > DISMISS_THRESHOLD
                      ? FOREST
                      : isDragging
                      ? CREAM_DIM
                      : HAIR_STRONG,
                  transform: isDragging ? 'scaleX(1.2)' : 'scaleX(1)',
                }}
              />
            </div>
            {isDragging && (
              <div className="text-center pb-1">
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] transition-colors"
                  style={{
                    color: dragOffset > DISMISS_THRESHOLD ? FOREST : CREAM_FAINT,
                  }}
                >
                  {dragOffset > DISMISS_THRESHOLD
                    ? 'Release to close'
                    : 'Swipe down to close'}
                </span>
              </div>
            )}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${HAIR}` }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className="w-1.5 h-1.5 flex-shrink-0"
                  style={{
                    background: FOREST,
                    boxShadow: `0 0 6px ${FOREST}`,
                    animation: 'beatHead 1.4s ease-in-out infinite',
                  }}
                  aria-hidden
                />
                <Link
                  href={`/market/${voiceMarketId}`}
                  className="truncate transition-colors"
                  style={{
                    color: CREAM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.95rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = CREAM)}
                >
                  {roomTitle || voiceMarketName || 'Voice circle'}
                </Link>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className="flex items-center gap-1 mono uppercase tracking-[0.22em] text-[0.55rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  <Users className="w-3 h-3" />
                  {totalParticipants}
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 transition-colors"
                  style={{ color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}` }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                  title="Minimize"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <CommunityHub
              marketId={voiceMarketId || ''}
              marketAddress={voiceMarketAddress || ''}
              marketName={voiceMarketName}
              walletAddress={walletAddress}
              founderWallet={null}
              hasPosition={true}
              className="h-full"
              onMinimize={() => setIsExpanded(false)}
            />
          </div>
        </div>
      </div>

      {/* Desktop: fixed right sidebar */}
      <div
        className="hidden lg:block fixed top-[6.5rem] right-4 w-[28%] min-w-[320px] max-w-[400px] z-30 overflow-hidden"
        style={{
          background: 'rgba(10,8,20,0.92)',
          border: `1px solid ${HAIR_STRONG}`,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: `1px solid ${HAIR}` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5"
              style={{
                background: FOREST,
                boxShadow: `0 0 6px ${FOREST}`,
                animation: 'beatHead 1.4s ease-in-out infinite',
              }}
              aria-hidden
            />
            <Link
              href={`/market/${voiceMarketId}`}
              className="transition-colors"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '0.92rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
              onMouseLeave={(e) => (e.currentTarget.style.color = CREAM)}
            >
              {roomTitle || voiceMarketName || 'Voice circle'}
            </Link>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 transition-colors"
            style={{ color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = CREAM;
              e.currentTarget.style.borderColor = AMBER + '88';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = CREAM_FAINT;
              e.currentTarget.style.borderColor = HAIR_STRONG;
            }}
            title="Minimize"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <CommunityHub
          marketId={voiceMarketId || ''}
          marketAddress={voiceMarketAddress || ''}
          marketName={voiceMarketName}
          walletAddress={walletAddress}
          founderWallet={null}
          hasPosition={true}
          className="h-[calc(100vh-9rem)]"
          onMinimize={() => setIsExpanded(false)}
        />
      </div>

      <style jsx>{`
        @keyframes beatHead {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </>
  );
}
