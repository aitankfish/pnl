'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Mic, MicOff, PhoneOff, Users, Maximize2, X } from 'lucide-react';
import { useVoiceRoomContextSafe, REACTION_EMOJIS } from '@/lib/context/VoiceRoomContext';
import Link from 'next/link';

export default function MiniVoicePlayer() {
  const voiceRoom = useVoiceRoomContextSafe();
  const pathname = usePathname();

  // Don't render if no voice room context or not connected
  if (!voiceRoom || !voiceRoom.isConnected) {
    return null;
  }

  // Don't render mini player if we're on the market page for this room
  const isOnRoomPage = pathname === `/market/${voiceRoom.marketAddress}`;
  if (isOnRoomPage) {
    return null;
  }

  const {
    marketAddress,
    marketName,
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
              href={`/market/${marketAddress}`}
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
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                isSpeaking ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-gray-900' : ''
              } bg-gradient-to-br from-cyan-500 to-purple-500`}
            >
              You
            </div>

            {/* Other participants (show up to 4) */}
            {participants.slice(0, 4).map((p) => (
              <div
                key={p.peerId}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                  p.isSpeaking ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-gray-900' : ''
                } bg-gradient-to-br from-gray-600 to-gray-700`}
              >
                {p.peerId.slice(0, 2).toUpperCase()}
              </div>
            ))}

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
