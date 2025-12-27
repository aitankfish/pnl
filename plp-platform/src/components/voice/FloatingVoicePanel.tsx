'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { Mic, MicOff, PhoneOff, Users, Minimize2 } from 'lucide-react';
import { useVoiceRoomContextSafe } from '@/lib/context/VoiceRoomContext';
import { useWallet } from '@/hooks/useWallet';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import CommunityHub to avoid circular dependencies
const CommunityHub = dynamic(() => import('@/components/chat/CommunityHub'), {
  loading: () => <div className="h-full bg-gray-900 animate-pulse" />,
  ssr: false,
});

export default function FloatingVoicePanel() {
  const voiceRoom = useVoiceRoomContextSafe();
  const pathname = usePathname();
  const params = useParams();
  const { primaryWallet } = useWallet();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Check if we're on a market page
  const isOnMarketPage = pathname?.startsWith('/market/');
  const currentMarketId = params?.id as string | undefined;

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
    return (
      <>
        {/* Desktop: Fixed right sidebar */}
        <div className="hidden lg:block fixed top-[6.5rem] right-4 w-[28%] min-w-[320px] max-w-[400px] z-30">
          <CommunityHub
            marketId={currentMarketId}
            marketAddress={currentMarketId}
            marketName=""
            walletAddress={walletAddress}
            founderWallet={null}
            hasPosition={true}
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
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-gray-700/50 shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
                <h2 className="text-lg font-semibold text-white">Community Hub</h2>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Minimize2 className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="h-[calc(100%-60px)]">
                <CommunityHub
                  marketId={currentMarketId}
                  marketAddress={currentMarketId}
                  marketName=""
                  walletAddress={walletAddress}
                  founderWallet={null}
                  hasPosition={true}
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
        <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-gray-700/50 shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <Link
                href={`/market/${voiceMarketId}`}
                className="text-lg font-semibold text-white hover:text-cyan-400 transition-colors"
              >
                {roomTitle || voiceMarketName || 'Voice Room'}
              </Link>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Minimize"
            >
              <Minimize2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="h-[calc(100%-60px)]">
            <CommunityHub
              marketId={voiceMarketId || ''}
              marketAddress={voiceMarketAddress || ''}
              marketName={voiceMarketName}
              walletAddress={walletAddress}
              founderWallet={null}
              hasPosition={true}
              className="h-full rounded-none border-0"
              onMinimize={() => setIsExpanded(false)}
            />
          </div>
        </div>
      </div>

      {/* Desktop: Fixed right sidebar */}
      <div className="hidden lg:block fixed top-[6.5rem] right-4 w-[28%] min-w-[320px] max-w-[400px] z-30">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/95 backdrop-blur-sm border border-white/10 border-b-0 rounded-t-xl">
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
          className="h-[calc(100vh-7.5rem)] rounded-t-none"
          onMinimize={() => setIsExpanded(false)}
        />
      </div>
    </>
  );
}
