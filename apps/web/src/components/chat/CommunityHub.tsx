'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Mic, Send } from 'lucide-react';
import ChatRoom from './ChatRoom';
import VoiceRoom from '../voice/VoiceRoom';
import { useVoiceRoomContextSafe } from '@/lib/context/VoiceRoomContext';

// ── Cosmic-plant palette (shared across the app) ──
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

// Custom Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Custom Twitter/X icon component
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// Custom LinkedIn icon component
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// Hairline cosmic social link — replaces the gradient-tinted icon buttons.
// Color tints to amber on hover; otherwise stays cream-dim so it doesn't
// fight the chat/voice content for attention.
function SocialLink({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="p-1.5 inline-flex items-center justify-center transition-colors"
      style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = AMBER;
        e.currentTarget.style.borderColor = AMBER + '88';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = CREAM_DIM;
        e.currentTarget.style.borderColor = HAIR_STRONG;
      }}
    >
      {children}
    </a>
  );
}

interface SocialLinks {
  twitter?: string;
  discord?: string;
  telegram?: string;
  linkedin?: string;
}

interface CommunityHubProps {
  marketId: string; // URL param ID (MongoDB ID or Solana address)
  marketAddress: string;
  marketName?: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
  socialLinks?: SocialLinks;
  className?: string;
  onMinimize?: () => void; // Callback to minimize/close the panel (mobile)
}

type TabType = 'chat' | 'voice';

// Use same env var pattern as VoiceRoomContext
const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'http://localhost:3002';

export default function CommunityHub({
  marketId,
  marketAddress,
  marketName,
  walletAddress,
  founderWallet,
  hasPosition,
  socialLinks,
  className,
  onMinimize,
}: CommunityHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [voiceRoomActive, setVoiceRoomActive] = useState(false);
  const [voiceParticipantCount, setVoiceParticipantCount] = useState(0);
  const voiceRoom = useVoiceRoomContextSafe();

  // Check if user is connected to this room
  const isConnectedToThisRoom = voiceRoom?.isConnected && voiceRoom?.marketAddress === marketAddress;

  // Update state when user is connected to this room
  useEffect(() => {
    if (isConnectedToThisRoom) {
      setVoiceRoomActive(true);
      setVoiceParticipantCount((voiceRoom?.participants?.length || 0) + 1); // +1 for self
    }
  }, [isConnectedToThisRoom, voiceRoom?.participants?.length]);

  // Poll voice server for room status when NOT connected (for visitors)
  useEffect(() => {
    // Don't poll if user is already connected to this room
    if (isConnectedToThisRoom) return;

    const fetchRoomStatus = async () => {
      try {
        const response = await fetch(`${VOICE_SERVER_URL}/room-status/${marketAddress}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          setVoiceRoomActive(data.active && data.participantCount > 0);
          setVoiceParticipantCount(data.participantCount || 0);
        } else {
          // Room doesn't exist or server error - assume inactive
          setVoiceRoomActive(false);
          setVoiceParticipantCount(0);
        }
      } catch (error) {
        // Network error or endpoint not available - silently fail
        setVoiceRoomActive(false);
        setVoiceParticipantCount(0);
      }
    };

    // Initial fetch
    fetchRoomStatus();

    // Poll every 10 seconds
    const interval = setInterval(fetchRoomStatus, 10000);

    return () => clearInterval(interval);
  }, [marketAddress, isConnectedToThisRoom]);

  const tabs = [
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
    { id: 'voice' as TabType, label: 'Voice', icon: Mic },
  ];

  const hasSocialLinks = socialLinks && (socialLinks.twitter || socialLinks.discord || socialLinks.telegram || socialLinks.linkedin);

  return (
    <div
      className={`flex flex-col overflow-hidden ${className || 'h-[500px] sm:h-[600px]'}`}
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
      }}
    >
      {/* Social links bar */}
      {hasSocialLinks && (
        <div
          className="flex items-center justify-center gap-1.5 px-3 py-2"
          style={{ borderBottom: `1px solid ${HAIR}` }}
        >
          <span
            className="mono uppercase tracking-[0.24em] text-[0.5rem] mr-1"
            style={{ color: CREAM_FAINT }}
          >
            Find them on
          </span>
          {socialLinks.twitter && (
            <SocialLink href={socialLinks.twitter} title="Twitter / X">
              <TwitterIcon className="w-3 h-3" />
            </SocialLink>
          )}
          {socialLinks.discord && (
            <SocialLink href={socialLinks.discord} title="Discord">
              <DiscordIcon className="w-3 h-3" />
            </SocialLink>
          )}
          {socialLinks.telegram && (
            <SocialLink href={socialLinks.telegram} title="Telegram">
              <Send className="w-3 h-3" />
            </SocialLink>
          )}
          {socialLinks.linkedin && (
            <SocialLink href={socialLinks.linkedin} title="LinkedIn">
              <LinkedInIcon className="w-3 h-3" />
            </SocialLink>
          )}
        </div>
      )}

      {/* Tab header */}
      <div className="flex" style={{ borderBottom: `1px solid ${HAIR}` }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isVoiceTab = tab.id === 'voice';
          const showLiveIndicator = isVoiceTab && voiceRoomActive;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 mono uppercase tracking-[0.26em] text-[0.6rem] py-3 px-3 transition-colors relative inline-flex items-center justify-center gap-2"
              style={{
                color: isActive ? CREAM : showLiveIndicator ? FOREST : CREAM_DIM,
                background: isActive ? 'rgba(232,150,96,0.06)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = CREAM;
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = showLiveIndicator ? FOREST : CREAM_DIM;
              }}
            >
              {showLiveIndicator && (
                <span
                  className="w-1.5 h-1.5"
                  style={{
                    background: FOREST,
                    boxShadow: `0 0 6px ${FOREST}`,
                    animation: 'beatDot 1.4s ease-in-out infinite',
                  }}
                  aria-hidden
                />
              )}
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              {showLiveIndicator && voiceParticipantCount > 0 && (
                <span
                  className="mono text-[0.55rem] tracking-[0.1em]"
                  style={{ color: FOREST }}
                >
                  · {voiceParticipantCount}
                </span>
              )}
              {isActive && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-px"
                  style={{ background: showLiveIndicator ? FOREST : AMBER }}
                />
              )}
            </button>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes beatDot {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatRoom
            marketAddress={marketAddress}
            walletAddress={walletAddress}
            founderWallet={founderWallet}
            hasPosition={hasPosition}
            className="h-full rounded-none border-0"
          />
        )}

        {activeTab === 'voice' && (
          <VoiceRoom
            marketId={marketId}
            marketAddress={marketAddress}
            marketName={marketName}
            walletAddress={walletAddress}
            founderWallet={founderWallet}
            hasPosition={hasPosition}
            onMinimize={onMinimize}
          />
        )}
      </div>
    </div>
  );
}
