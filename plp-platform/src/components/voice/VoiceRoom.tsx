'use client';

import React, { useState } from 'react';
import { Mic, MicOff, PhoneOff, Loader2, Users, AlertCircle, Hand, MoreVertical, UserX, VolumeX, Check, X, Edit2 } from 'lucide-react';
import { useVoiceRoom, REACTION_EMOJIS } from '@/lib/hooks/useVoiceRoom';

interface VoiceRoomProps {
  marketAddress: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
}

// Floating reaction component
function FloatingReaction({ emoji, id }: { emoji: string; id: string }) {
  const randomX = React.useMemo(() => Math.random() * 60 + 20, []);

  return (
    <div
      key={id}
      className="absolute bottom-20 animate-float-up pointer-events-none"
      style={{ left: `${randomX}%` }}
    >
      <span className="text-3xl">{emoji}</span>
    </div>
  );
}

// Avatar component for speakers
function SpeakerAvatar({
  address,
  role,
  isMuted,
  isSpeaking,
  isSelf,
  isFounder,
  hasRaisedHand,
  isHost,
  onKick,
  onMute,
  onApproveHand,
}: {
  address: string;
  role: 'Host' | 'Speaker';
  isMuted: boolean;
  isSpeaking?: boolean;
  isSelf?: boolean;
  isFounder?: boolean;
  hasRaisedHand?: boolean;
  isHost?: boolean;
  onKick?: () => void;
  onMute?: () => void;
  onApproveHand?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const initials = address.slice(0, 2).toUpperCase();
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  return (
    <div className="flex flex-col items-center gap-1.5 w-20 relative">
      {/* Avatar with speaking indicator */}
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all ${
            isSelf
              ? 'bg-gradient-to-br from-cyan-500 to-purple-500'
              : isFounder
              ? 'bg-gradient-to-br from-amber-500 to-orange-500'
              : 'bg-gradient-to-br from-gray-600 to-gray-700'
          } ${isSpeaking ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900 animate-pulse' : ''}`}
        >
          {initials}
        </div>
        {/* Raised hand indicator */}
        {hasRaisedHand && (
          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center animate-bounce">
            <Hand className="w-3 h-3 text-white" />
          </div>
        )}
        {/* Mic status indicator */}
        <div
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
            isMuted ? 'bg-gray-700' : 'bg-green-500'
          }`}
        >
          {isMuted ? (
            <MicOff className="w-3 h-3 text-gray-400" />
          ) : (
            <Mic className="w-3 h-3 text-white" />
          )}
        </div>
        {/* Host menu button */}
        {isHost && !isSelf && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center"
          >
            <MoreVertical className="w-3 h-3 text-gray-400" />
          </button>
        )}
        {/* Host dropdown menu */}
        {showMenu && isHost && !isSelf && (
          <div className="absolute top-6 right-0 z-10 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px]">
            {hasRaisedHand && onApproveHand && (
              <button
                onClick={() => { onApproveHand(); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-green-400 hover:bg-gray-700 flex items-center gap-2"
              >
                <Check className="w-3 h-3" /> Approve
              </button>
            )}
            {onMute && (
              <button
                onClick={() => { onMute(); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-yellow-400 hover:bg-gray-700 flex items-center gap-2"
              >
                <VolumeX className="w-3 h-3" /> Mute
              </button>
            )}
            {onKick && (
              <button
                onClick={() => { onKick(); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-gray-700 flex items-center gap-2"
              >
                <UserX className="w-3 h-3" /> Remove
              </button>
            )}
          </div>
        )}
      </div>
      {/* Name */}
      <p className="text-xs text-white font-medium truncate max-w-full">
        {isSelf ? 'You' : shortAddress}
      </p>
      {/* Role */}
      <p className="text-[10px] text-gray-400">{role}</p>
    </div>
  );
}

export default function VoiceRoom({
  marketAddress,
  walletAddress,
  founderWallet,
  hasPosition,
}: VoiceRoomProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const {
    isConnected,
    isConnecting,
    participants,
    isMuted,
    isSpeaking,
    hasRaisedHand,
    reactions,
    roomTitle,
    isHost,
    error,
    join,
    leave,
    toggleMute,
    toggleHand,
    sendReaction,
    kickUser,
    muteUser,
    updateRoomTitle,
    approveHand,
  } = useVoiceRoom({ marketAddress, walletAddress, founderWallet });

  const canJoin = walletAddress && (hasPosition || walletAddress === founderWallet);
  const isFounder = walletAddress === founderWallet;

  const handleSaveTitle = () => {
    updateRoomTitle(titleInput);
    setIsEditingTitle(false);
  };

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

        <p className="text-xs text-gray-500">Your mic will be off to start</p>

        {!walletAddress ? (
          <div className="w-full px-4 py-3 bg-white/5 rounded-full border border-white/10 text-center">
            <span className="text-sm text-gray-400">Sign in to join voice chat</span>
          </div>
        ) : !canJoin ? (
          <div className="w-full px-4 py-3 bg-amber-500/10 rounded-full border border-amber-500/20 text-center">
            <span className="text-sm text-amber-300">Vote YES or NO to unlock voice</span>
          </div>
        ) : (
          <button
            onClick={join}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-full font-semibold text-white text-base transition-all disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              'Start listening'
            )}
          </button>
        )}
      </div>
    );
  }

  // Connected state - X Spaces style
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Floating reactions */}
      {reactions.map((reaction) => (
        <FloatingReaction key={reaction.id} emoji={reaction.emoji} id={reaction.id} />
      ))}

      {/* Header with room title */}
      <div className="flex flex-col px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium text-white">Live</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />
            <span>{participants.length + 1} listening</span>
          </div>
        </div>
        {/* Room title */}
        {isEditingTitle ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Enter room topic..."
              className="flex-1 px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              maxLength={50}
              autoFocus
            />
            <button
              onClick={handleSaveTitle}
              className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsEditingTitle(false)}
              className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : roomTitle ? (
          <div className="flex items-center gap-2 mt-2">
            <p className="text-sm text-gray-300 truncate">{roomTitle}</p>
            {isHost && (
              <button
                onClick={() => { setTitleInput(roomTitle); setIsEditingTitle(true); }}
                className="p-1 rounded hover:bg-white/10"
              >
                <Edit2 className="w-3 h-3 text-gray-500" />
              </button>
            )}
          </div>
        ) : isHost ? (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-400 text-left"
          >
            + Add room topic
          </button>
        ) : null}
      </div>

      {/* Speakers Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap justify-center gap-4">
          {/* Self - Host if founder, otherwise Speaker */}
          <SpeakerAvatar
            address={walletAddress || ''}
            role={isFounder ? 'Host' : 'Speaker'}
            isMuted={isMuted}
            isSpeaking={isSpeaking}
            isSelf={true}
            isFounder={isFounder}
            hasRaisedHand={hasRaisedHand}
          />

          {/* Other participants */}
          {participants.map((participant) => (
            <SpeakerAvatar
              key={participant.peerId}
              address={participant.peerId}
              role={participant.peerId === founderWallet ? 'Host' : 'Speaker'}
              isMuted={participant.isMuted}
              isSpeaking={participant.isSpeaking}
              isFounder={participant.peerId === founderWallet}
              hasRaisedHand={participant.hasRaisedHand}
              isHost={isHost}
              onKick={() => kickUser(participant.peerId)}
              onMute={() => muteUser(participant.peerId)}
              onApproveHand={participant.hasRaisedHand ? () => approveHand(participant.peerId) : undefined}
            />
          ))}
        </div>

        {/* Raised hands queue for host */}
        {isHost && participants.some(p => p.hasRaisedHand) && (
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-xs text-yellow-400 mb-2 flex items-center gap-1">
              <Hand className="w-3 h-3" /> Raised hands
            </p>
            <div className="flex flex-wrap gap-2">
              {participants.filter(p => p.hasRaisedHand).map(p => (
                <button
                  key={p.peerId}
                  onClick={() => approveHand(p.peerId)}
                  className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded-lg hover:bg-yellow-500/30 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  {p.peerId.slice(0, 4)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listener count */}
        {participants.length > 0 && !participants.some(p => p.hasRaisedHand) && (
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-sm text-gray-400 px-2">
              {participants.length} other {participants.length === 1 ? 'listener' : 'listeners'}
            </p>
          </div>
        )}
      </div>

      {/* Reaction buttons */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-white/5">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all"
            title={`React with ${emoji}`}
          >
            <span className="text-xl">{emoji}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-4 border-t border-white/5">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-all ${
            isMuted
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={toggleHand}
          className={`p-4 rounded-full transition-all ${
            hasRaisedHand
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={hasRaisedHand ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className="w-6 h-6" />
        </button>

        <button
          onClick={leave}
          className="px-6 py-3 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition-all flex items-center gap-2"
        >
          <PhoneOff className="w-5 h-5" />
          Leave
        </button>
      </div>
    </div>
  );
}
