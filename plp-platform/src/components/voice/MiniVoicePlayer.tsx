'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Mic, MicOff, PhoneOff, Users, Maximize2, X } from 'lucide-react';
import { useVoiceRoomContextSafe, REACTION_EMOJIS } from '@/lib/context/VoiceRoomContext';
import Link from 'next/link';

interface ProfileData {
  username?: string;
  profilePhotoUrl?: string;
}

export default function MiniVoicePlayer() {
  const voiceRoom = useVoiceRoomContextSafe();
  const pathname = usePathname();
  const [profiles, setProfiles] = useState<Record<string, ProfileData>>({});

  // Don't render if no voice room context or not connected
  if (!voiceRoom || !voiceRoom.isConnected) {
    return null;
  }

  // Don't render mini player if we're on the market page for this room
  // Use marketId (URL param) for comparison since that's what's in the URL
  const isOnRoomPage = pathname?.startsWith('/market/') &&
    voiceRoom.marketId &&
    pathname.toLowerCase().includes(voiceRoom.marketId.toLowerCase());

  if (isOnRoomPage) {
    return null;
  }

  const {
    marketId,
    marketName,
    walletAddress,
    participants,
    isMuted,
    isSpeaking,
    roomTitle,
    toggleMute,
    leave,
    sendReaction,
    isReconnecting,
    reconnectAttempts,
  } = voiceRoom;

  // Fetch profiles for participants
  useEffect(() => {
    const fetchProfiles = async () => {
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
        const response = await fetch('/api/profiles/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallets: walletsToFetch }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setProfiles(prev => ({ ...prev, ...data.data }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch profiles:', error);
      }
    };

    fetchProfiles();
  }, [participants, walletAddress]);

  const selfProfile = walletAddress ? profiles[walletAddress] : null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-up">
      <div className="bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Reconnecting banner */}
        {isReconnecting && (
          <div className="bg-yellow-500/90 px-3 py-1.5 text-center">
            <span className="text-xs text-black font-medium">
              Reconnecting... ({reconnectAttempts}/5)
            </span>
          </div>
        )}

        {/* Main content */}
        <div className="p-3">
          {/* Header with room info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {roomTitle || marketName || 'Voice Room'}
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Users className="w-3 h-3" />
                  <span>{participants.length + 1} listening</span>
                </div>
              </div>
            </div>

            {/* Expand button */}
            <Link
              href={`/market/${marketId}`}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Open full room"
            >
              <Maximize2 className="w-4 h-4" />
            </Link>
          </div>

          {/* Participant avatars */}
          <div className="flex items-center gap-1 mb-3 overflow-hidden">
            {/* Self */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden ${
                isSpeaking ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-gray-900' : ''
              } bg-gradient-to-br from-cyan-500 to-purple-500`}
            >
              {selfProfile?.profilePhotoUrl ? (
                <img src={selfProfile.profilePhotoUrl} alt="You" className="w-full h-full object-cover" />
              ) : (
                'You'
              )}
            </div>

            {/* Other participants (show up to 4) */}
            {participants.slice(0, 4).map((p) => {
              const pProfile = profiles[p.peerId];
              const pInitials = pProfile?.username?.slice(0, 2).toUpperCase() || p.peerId.slice(0, 2).toUpperCase();
              const pName = pProfile?.username || `${p.peerId.slice(0, 4)}...${p.peerId.slice(-4)}`;
              return (
                <Link
                  key={p.peerId}
                  href={`/profile/${p.peerId}`}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden hover:opacity-80 transition-opacity ${
                    p.isSpeaking ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-gray-900' : ''
                  } bg-gradient-to-br from-gray-600 to-gray-700`}
                  title={`View ${pName}'s profile`}
                >
                  {pProfile?.profilePhotoUrl ? (
                    <img src={pProfile.profilePhotoUrl} alt={pProfile.username || 'Participant'} className="w-full h-full object-cover" />
                  ) : (
                    pInitials
                  )}
                </Link>
              );
            })}

            {/* More indicator */}
            {participants.length > 4 && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-gray-400 bg-gray-800 flex-shrink-0">
                +{participants.length - 4}
              </div>
            )}
          </div>

          {/* Quick reactions */}
          <div className="flex items-center gap-1 mb-3">
            {REACTION_EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all"
              >
                <span className="text-sm">{emoji}</span>
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isMuted
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>

            <button
              onClick={leave}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium text-sm transition-all"
            >
              <PhoneOff className="w-4 h-4" />
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
