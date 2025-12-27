'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { Mic, MicOff, PhoneOff, Users, Minimize2, Wifi, WifiOff } from 'lucide-react';
import { useVoiceRoomContextSafe } from '@/lib/context/VoiceRoomContext';
import { useWallet } from '@/hooks/useWallet';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import useSWR from 'swr';

// Dynamically import CommunityHub to avoid circular dependencies
const CommunityHub = dynamic(() => import('@/components/chat/CommunityHub'), {
  loading: () => <div className="h-full bg-gray-900 animate-pulse" />,
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

  // Swipe gesture handling
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    const deltaTime = Date.now() - touchStartTime.current;

    // Swipe down to minimize: must be quick swipe (< 300ms) and move at least 50px down
    if (deltaY > 50 && deltaTime < 300) {
      setIsMobileSidebarOpen(false);
    }
  }, []);

  // Touch handlers for expanded view (must be before any returns to follow Rules of Hooks)
  const handleExpandedTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleExpandedTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    const deltaTime = Date.now() - touchStartTime.current;

    if (deltaY > 50 && deltaTime < 300) {
      setIsExpanded(false);
    }
  }, []);

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

        {/* Mobile: Chat button + Sidebar */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:scale-105"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>

        {/* Mobile Sidebar */}
        {isMobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div
              ref={sidebarRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-gray-700/50 shadow-2xl animate-in slide-in-from-right duration-300"
            >
              {/* Swipe indicator */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-600" />
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50">
                <h2 className="text-base font-medium text-white truncate flex-1 mr-2">{marketData?.name || 'Community'}</h2>
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-green-400" />
                  <button
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Minimize2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="h-[calc(100%-52px)]">
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

  // Minimized bar view - clean like X Spaces
  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
        <div className="bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-full shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2">
            {/* Live indicator */}
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />

            {/* Room name - tap to expand */}
            <button
              onClick={() => setIsExpanded(true)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-sm font-medium text-white truncate">
                {roomTitle || voiceMarketName || 'Voice Room'}
              </p>
            </button>

            {/* Participant count */}
            <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
              <Users className="w-3.5 h-3.5" />
              <span>{totalParticipants}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Mute toggle */}
              <button
                onClick={() => voiceRoom.toggleMute()}
                className={`p-2 rounded-full transition-all ${
                  isMuted
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Leave button */}
              <button
                onClick={() => voiceRoom.leave()}
                className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                title="Leave"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view - floating panel for voice room from another market
  return (
    <>
      {/* Mobile: Full screen slide-in panel */}
      <div className="lg:hidden fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        />
        <div
          onTouchStart={handleExpandedTouchStart}
          onTouchEnd={handleExpandedTouchEnd}
          className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-gray-900/85 backdrop-blur-xl border-l border-white/10 shadow-2xl shadow-black/50 animate-in slide-in-from-right duration-300"
        >
          {/* Swipe indicator */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <Link
                href={`/market/${voiceMarketId}`}
                className="text-base font-medium text-white hover:text-cyan-400 transition-colors truncate"
              >
                {roomTitle || voiceMarketName || 'Voice Room'}
              </Link>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Users className="w-3.5 h-3.5" />
                <span>{totalParticipants}</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          <div className="h-[calc(100%-52px)]">
            <CommunityHub
              marketId={voiceMarketId || ''}
              marketAddress={voiceMarketAddress || ''}
              marketName={voiceMarketName}
              walletAddress={walletAddress}
              founderWallet={null}
              hasPosition={true}
              className="h-full rounded-none border-0 bg-transparent"
              onMinimize={() => setIsExpanded(false)}
            />
          </div>
        </div>
      </div>

      {/* Desktop: Fixed right sidebar */}
      <div className="hidden lg:block fixed top-[6.5rem] right-4 w-[28%] min-w-[320px] max-w-[400px] z-30 bg-gray-900/80 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <Link
              href={`/market/${voiceMarketId}`}
              className="text-sm font-medium text-white hover:text-cyan-400 transition-colors"
            >
              {roomTitle || voiceMarketName || 'Voice Room'}
            </Link>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
        <CommunityHub
          marketId={voiceMarketId || ''}
          marketAddress={voiceMarketAddress || ''}
          marketName={voiceMarketName}
          walletAddress={walletAddress}
          founderWallet={null}
          hasPosition={true}
          className="h-[calc(100vh-9rem)] rounded-none border-0 bg-transparent"
          onMinimize={() => setIsExpanded(false)}
        />
      </div>
    </>
  );
}
