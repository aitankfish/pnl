'use client';

import React from 'react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Users, AlertCircle } from 'lucide-react';
import { useVoiceRoom } from '@/lib/hooks/useVoiceRoom';

interface VoiceRoomProps {
  marketAddress: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
}

export default function VoiceRoom({
  marketAddress,
  walletAddress,
  founderWallet,
  hasPosition,
}: VoiceRoomProps) {
  const {
    isConnected,
    isConnecting,
    participants,
    isMuted,
    error,
    join,
    leave,
    toggleMute,
  } = useVoiceRoom({ marketAddress, walletAddress });

  const canJoin = walletAddress && (hasPosition || walletAddress === founderWallet);

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
          <Mic className="w-8 h-8 text-cyan-400" />
        </div>

        <div className="text-center">
          <h3 className="text-lg font-medium text-white mb-1">Voice Room</h3>
          <p className="text-sm text-gray-400 max-w-xs">
            Join the live voice chat to discuss this project with the community.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}

        {!walletAddress ? (
          <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
            <span className="text-sm text-gray-400">Sign in to join voice chat</span>
          </div>
        ) : !canJoin ? (
          <div className="px-4 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <span className="text-sm text-amber-300">Vote YES or NO to unlock voice</span>
          </div>
        ) : (
          <button
            onClick={join}
            disabled={isConnecting}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-xl font-medium text-white transition-all disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="w-5 h-5" />
                Join Voice
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // Connected state
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-white">Live</span>
          <div className="flex items-center gap-1 text-xs text-gray-400 ml-2">
            <Users className="w-3 h-3" />
            <span>{participants.length + 1}</span>
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {/* Self */}
          <div className="flex items-center gap-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <span className="text-xs font-bold text-white">You</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
              </p>
              <p className="text-xs text-gray-400">
                {isMuted ? 'Muted' : 'Speaking'}
              </p>
            </div>
            {isMuted ? (
              <MicOff className="w-4 h-4 text-red-400" />
            ) : (
              <Mic className="w-4 h-4 text-green-400" />
            )}
          </div>

          {/* Other participants */}
          {participants.map((participant) => (
            <div
              key={participant.peerId}
              className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {participant.peerId.slice(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {participant.peerId.slice(0, 4)}...{participant.peerId.slice(-4)}
                </p>
              </div>
              {participant.isMuted ? (
                <MicOff className="w-4 h-4 text-red-400" />
              ) : (
                <Mic className="w-4 h-4 text-green-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-4 border-t border-cyan-500/10">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-all ${
            isMuted
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : 'bg-cyan-500 hover:bg-cyan-600 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={leave}
          className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
