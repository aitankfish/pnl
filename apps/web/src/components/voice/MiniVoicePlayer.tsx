'use client';

import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { usePathname } from 'next/navigation';
import { Mic, MicOff, PhoneOff, Users, Maximize2 } from 'lucide-react';
import { useVoiceRoomContextSafe, REACTION_EMOJIS } from '@/lib/context/VoiceRoomContext';
import Link from 'next/link';

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

interface ProfileData {
  username?: string;
  profilePhotoUrl?: string;
}

// Check if string looks like a valid Solana wallet address (base58, 32-44 chars)
const isValidWalletAddress = (str: string): boolean => {
  return str.length >= 32 && str.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
};

export default function MiniVoicePlayer() {
  // ALL HOOKS MUST BE AT THE TOP - before any conditional returns
  const voiceRoom = useVoiceRoomContextSafe();
  const pathname = usePathname();
  const [profiles, setProfiles] = useState<Record<string, ProfileData>>({});
  const isMountedRef = useRef(true);

  // Extract values safely (these may be undefined if voiceRoom is null)
  const isConnected = voiceRoom?.isConnected ?? false;
  const marketId = voiceRoom?.marketId ?? null;
  const marketName = voiceRoom?.marketName ?? '';
  const walletAddress = voiceRoom?.walletAddress ?? null;
  const participants = voiceRoom?.participants ?? [];
  const isMuted = voiceRoom?.isMuted ?? true;
  const isSpeaking = voiceRoom?.isSpeaking ?? false;
  const roomTitle = voiceRoom?.roomTitle ?? '';
  const isReconnecting = voiceRoom?.isReconnecting ?? false;
  const reconnectAttempts = voiceRoom?.reconnectAttempts ?? 0;

  // Fetch profiles for participants - HOOK MUST BE BEFORE CONDITIONAL RETURNS
  useEffect(() => {
    isMountedRef.current = true;

    const fetchProfiles = async () => {
      // Don't fetch if not connected or no wallet
      if (!isConnected || !walletAddress) return;

      const walletsToFetch: string[] = [];

      // Add self wallet
      if (walletAddress && !profiles[walletAddress]) {
        walletsToFetch.push(walletAddress);
      }

      // Add participant wallets
      participants.slice(0, 4).forEach(p => {
        if (!profiles[p.peerId]) {
          walletsToFetch.push(p.peerId);
        }
      });

      if (walletsToFetch.length === 0) return;

      try {
        const response = await authFetch('/api/profiles/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallets: walletsToFetch }),
        });

        if (response.ok && isMountedRef.current) {
          const data = await response.json();
          if (data.success && data.data && isMountedRef.current) {
            setProfiles(prev => ({ ...prev, ...data.data }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch profiles:', error);
      }
    };

    fetchProfiles();

    return () => {
      isMountedRef.current = false;
    };
  }, [isConnected, participants, walletAddress]);

  // NOW we can do conditional returns - AFTER all hooks
  // Don't render if no voice room context or not connected
  if (!voiceRoom || !isConnected) {
    return null;
  }

  // Check if we're on the market page for this room
  const isOnRoomPage = pathname?.startsWith('/market/') &&
    marketId &&
    pathname.toLowerCase().includes(marketId.toLowerCase());

  // On mobile (md and below), ALWAYS show mini player even when on market page
  // This allows users to minimize the voice room sidebar and still see the mini player
  // On desktop (lg and above), hide when on market page since full voice room is visible
  // We use CSS to handle this: show on mobile, hide on desktop when on market page
  const hideOnDesktopWhenOnPage = isOnRoomPage;

  const selfProfile = walletAddress ? profiles[walletAddress] : null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-up ${
        hideOnDesktopWhenOnPage ? 'lg:hidden' : ''
      }`}
    >
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
        {/* Reconnecting banner */}
        {isReconnecting && (
          <div className="px-3 py-1.5 text-center" style={{ background: AMBER, color: BG }}>
            <span className="mono uppercase tracking-[0.22em] text-[0.55rem]">
              Reconnecting · {reconnectAttempts}/5
            </span>
          </div>
        )}

        <div className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className="w-1.5 h-1.5 flex-shrink-0"
                style={{
                  background: FOREST,
                  boxShadow: `0 0 6px ${FOREST}`,
                  animation: 'beatMini 1.4s ease-in-out infinite',
                }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{
                    color: CREAM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontSize: '0.92rem',
                  }}
                >
                  {roomTitle || marketName || 'Voice circle'}
                </p>
                <p
                  className="mono uppercase tracking-[0.22em] text-[0.5rem] inline-flex items-center gap-1"
                  style={{ color: CREAM_FAINT }}
                >
                  <Users className="w-2.5 h-2.5" />
                  {participants.length + 1} listening
                </p>
              </div>
            </div>

            <Link
              href={`/market/${marketId}`}
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
              title="Open full room"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Participant tiles */}
          <div className="flex items-center gap-1 mb-3 overflow-hidden">
            {/* Self */}
            <div
              className="w-7 h-7 flex items-center justify-center mono text-[0.55rem] flex-shrink-0 overflow-hidden"
              style={{
                background: `${AMBER}22`,
                color: AMBER,
                border: `1px solid ${AMBER}55`,
                boxShadow: isSpeaking ? `0 0 0 2px ${FOREST}88, 0 0 12px ${FOREST}55` : 'none',
              }}
            >
              {selfProfile?.profilePhotoUrl ? (
                <img
                  src={selfProfile.profilePhotoUrl}
                  alt="You"
                  className="w-full h-full object-cover"
                />
              ) : (
                'YO'
              )}
            </div>

            {participants.slice(0, 4).map((p) => {
              const pProfile = profiles[p.peerId];
              const pInitials =
                pProfile?.username?.slice(0, 2).toUpperCase() ||
                p.peerId.slice(0, 2).toUpperCase();
              const pName =
                pProfile?.username || `${p.peerId.slice(0, 4)}...${p.peerId.slice(-4)}`;
              const canLink = isValidWalletAddress(p.peerId);

              const avatarContent = (
                <>
                  {pProfile?.profilePhotoUrl ? (
                    <img
                      src={pProfile.profilePhotoUrl}
                      alt={pProfile.username || 'Participant'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    pInitials
                  )}
                </>
              );

              const tileStyle: React.CSSProperties = {
                background: HAIR_STRONG,
                color: CREAM_DIM,
                border: `1px solid ${HAIR_STRONG}`,
                boxShadow: p.isSpeaking
                  ? `0 0 0 2px ${FOREST}88, 0 0 12px ${FOREST}55`
                  : 'none',
              };
              const tileClass =
                'w-7 h-7 flex items-center justify-center mono text-[0.55rem] flex-shrink-0 overflow-hidden transition-opacity';

              return canLink ? (
                <Link
                  key={p.peerId}
                  href={`/profile/${p.peerId}`}
                  className={`${tileClass} hover:opacity-80`}
                  style={tileStyle}
                  title={`View ${pName}'s profile`}
                >
                  {avatarContent}
                </Link>
              ) : (
                <div key={p.peerId} className={tileClass} style={tileStyle}>
                  {avatarContent}
                </div>
              );
            })}

            {participants.length > 4 && (
              <div
                className="w-7 h-7 flex items-center justify-center mono text-[0.55rem] flex-shrink-0"
                style={{
                  background: HAIR,
                  color: CREAM_FAINT,
                  border: `1px solid ${HAIR_STRONG}`,
                }}
              >
                +{participants.length - 4}
              </div>
            )}
          </div>

          {/* Quick reactions */}
          <div className="flex items-center gap-1 mb-3">
            {REACTION_EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                onClick={() => voiceRoom.sendReaction(emoji)}
                className="p-1.5 active:scale-90 transition-all"
                style={{ color: CREAM_DIM }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(244,238,228,0.04)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-sm">{emoji}</span>
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => voiceRoom.toggleMute()}
              className="flex-1 mono uppercase tracking-[0.24em] text-[0.6rem] py-2.5 inline-flex items-center justify-center gap-1.5 transition-colors"
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
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {isMuted ? 'Muted' : 'Live'}
            </button>

            <button
              onClick={() => voiceRoom.leave()}
              className="mono uppercase tracking-[0.24em] text-[0.6rem] px-4 py-2.5 inline-flex items-center gap-1.5 transition-colors"
              style={{ color: EARTH, border: `1px solid ${EARTH}55` }}
              onMouseEnter={(e) => (e.currentTarget.style.background = `${EARTH}11`)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <PhoneOff className="w-3.5 h-3.5" />
              Leave
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes beatMini {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
