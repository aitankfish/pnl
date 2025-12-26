'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Loader2, Users, AlertCircle, Hand, MoreVertical, UserX, VolumeX, Check, X, Edit2, Share2, Link, Star, Crown, Wifi, WifiOff } from 'lucide-react';
import { useVoiceRoomContext, REACTION_EMOJIS, MAX_SPEAKERS } from '@/lib/context/VoiceRoomContext';

interface VoiceRoomProps {
  marketId: string; // URL param ID (MongoDB ID or Solana address)
  marketAddress: string;
  marketName?: string;
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
  isCoHost,
  hasRaisedHand,
  isHost,
  isViewerFounder,
  onKick,
  onMute,
  onApproveHand,
  onAddCoHost,
  onRemoveCoHost,
}: {
  address: string;
  role: 'Host' | 'Co-host' | 'Speaker';
  isMuted: boolean;
  isSpeaking?: boolean;
  isSelf?: boolean;
  isFounder?: boolean;
  isCoHost?: boolean;
  hasRaisedHand?: boolean;
  isHost?: boolean;
  isViewerFounder?: boolean;
  onKick?: () => void;
  onMute?: () => void;
  onApproveHand?: () => void;
  onAddCoHost?: () => void;
  onRemoveCoHost?: () => void;
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
              : isCoHost
              ? 'bg-gradient-to-br from-purple-500 to-pink-500'
              : 'bg-gradient-to-br from-gray-600 to-gray-700'
          } ${isSpeaking ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900 animate-pulse' : ''}`}
        >
          {initials}
        </div>
        {/* Founder crown badge */}
        {isFounder && !isSelf && (
          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
            <Crown className="w-3 h-3 text-white" />
          </div>
        )}
        {/* Co-host star badge */}
        {isCoHost && !isFounder && !isSelf && (
          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
            <Star className="w-3 h-3 text-white" />
          </div>
        )}
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
            {/* Co-host controls - founder only */}
            {isViewerFounder && !isCoHost && !isFounder && onAddCoHost && (
              <button
                onClick={() => { onAddCoHost(); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-purple-400 hover:bg-gray-700 flex items-center gap-2"
              >
                <Star className="w-3 h-3" /> Make Co-host
              </button>
            )}
            {isViewerFounder && isCoHost && onRemoveCoHost && (
              <button
                onClick={() => { onRemoveCoHost(); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-xs text-left text-gray-400 hover:bg-gray-700 flex items-center gap-2"
              >
                <Star className="w-3 h-3" /> Remove Co-host
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
  marketId,
  marketAddress,
  marketName,
  walletAddress,
  founderWallet,
  hasPosition,
}: VoiceRoomProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [joinToast, setJoinToast] = useState<string | null>(null);

  const {
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    participants,
    isMuted,
    isSpeaking,
    hasRaisedHand,
    isSpeaker,
    speakerCount,
    canJoinAsSpeaker,
    reactions,
    roomTitle,
    isHost,
    isFounder,
    isTempHost,
    coHosts,
    showJoinChoice,
    error,
    join,
    joinAsSpeaker,
    joinAsListener,
    cancelJoinChoice,
    leave,
    toggleMute,
    toggleHand,
    sendReaction,
    kickUser,
    muteUser,
    muteAll,
    updateRoomTitle,
    approveHand,
    promoteToSpeaker,
    demoteToListener,
    addCoHost,
    removeCoHost,
  } = useVoiceRoomContext();

  const canJoin = walletAddress && (hasPosition || walletAddress === founderWallet);
  const prevParticipantsRef = useRef<number>(0);

  // Handle join with context
  const handleJoin = () => {
    if (walletAddress) {
      join(marketId, marketAddress, marketName || '', walletAddress, founderWallet || null);
    }
  };

  // Join notification effect
  useEffect(() => {
    if (isConnected && participants.length > prevParticipantsRef.current) {
      // Someone joined
      const newCount = participants.length - prevParticipantsRef.current;
      const latestParticipant = participants[participants.length - 1];
      const shortAddr = latestParticipant ?
        `${latestParticipant.peerId.slice(0, 4)}...${latestParticipant.peerId.slice(-4)}` :
        'Someone';

      setJoinToast(`${shortAddr} joined the room`);

      // Play a subtle notification sound
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);

      // Clear toast after 3 seconds
      setTimeout(() => setJoinToast(null), 3000);
    }
    prevParticipantsRef.current = participants.length;
  }, [participants.length, isConnected]);

  const handleShareLink = async () => {
    const roomUrl = `${window.location.origin}/market/${marketAddress}`;
    try {
      await navigator.clipboard.writeText(roomUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSaveTitle = () => {
    updateRoomTitle(titleInput);
    setIsEditingTitle(false);
  };

  // Separate speakers and listeners
  const speakers = participants.filter(p => p.isSpeaker);
  const listeners = participants.filter(p => !p.isSpeaker);

  // Join choice dialog
  if (showJoinChoice) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
          <Mic className="w-8 h-8 text-cyan-400" />
        </div>

        <div className="text-center">
          <h3 className="text-lg font-medium text-white mb-1">How do you want to join?</h3>
          <p className="text-sm text-gray-400 max-w-xs">
            {canJoinAsSpeaker
              ? `${MAX_SPEAKERS - speakerCount} speaker slots available`
              : 'All speaker slots are full'}
          </p>
        </div>

        <div className="w-full space-y-3">
          {canJoinAsSpeaker && (
            <button
              onClick={joinAsSpeaker}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-full font-semibold text-white text-base transition-all"
            >
              <Mic className="w-5 h-5" />
              Join as Speaker
            </button>
          )}

          <button
            onClick={joinAsListener}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 rounded-full font-medium text-white text-base transition-all"
          >
            <Users className="w-5 h-5" />
            Join as Listener
          </button>

          <button
            onClick={cancelJoinChoice}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-400 py-2"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Listeners can raise hand to request speaking
        </p>
      </div>
    );
  }

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
            onClick={handleJoin}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-full font-semibold text-white text-base transition-all disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              'Join Voice Room'
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

      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-yellow-500/90 px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-sm text-black font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Reconnecting... (attempt {reconnectAttempts}/5)
          </div>
        </div>
      )}

      {/* Join toast notification */}
      {joinToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-fade-in">
          <div className="px-4 py-2 bg-gray-800/90 backdrop-blur-sm border border-white/10 rounded-full shadow-lg">
            <div className="flex items-center gap-2 text-sm text-white">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              {joinToast}
            </div>
          </div>
        </div>
      )}

      {/* Header with room title */}
      <div className="flex flex-col px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium text-white">Live</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Users className="w-3.5 h-3.5" />
              <span>{participants.length + 1} listening</span>
            </div>
            <button
              onClick={handleShareLink}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-all"
              title="Share room link"
            >
              {showCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Link className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>
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
        {/* Speakers Section */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <Mic className="w-3 h-3" /> Speakers ({isSpeaker ? speakers.length + 1 : speakers.length}/{MAX_SPEAKERS})
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {/* Self - only show in speakers if isSpeaker */}
            {isSpeaker && (
              <SpeakerAvatar
                address={walletAddress || ''}
                role={isFounder ? 'Host' : isTempHost ? 'Host' : coHosts.includes(walletAddress || '') ? 'Co-host' : 'Speaker'}
                isMuted={isMuted}
                isSpeaking={isSpeaking}
                isSelf={true}
                isFounder={isFounder}
                isCoHost={coHosts.includes(walletAddress || '')}
                hasRaisedHand={hasRaisedHand}
              />
            )}

            {/* Other speakers */}
            {speakers.map((participant) => {
              const isParticipantFounder = participant.peerId === founderWallet;
              const isParticipantCoHost = coHosts.includes(participant.peerId);
              const participantRole = isParticipantFounder ? 'Host' : isParticipantCoHost ? 'Co-host' : 'Speaker';

              return (
                <SpeakerAvatar
                  key={participant.peerId}
                  address={participant.peerId}
                  role={participantRole}
                  isMuted={participant.isMuted}
                  isSpeaking={participant.isSpeaking}
                  isFounder={isParticipantFounder}
                  isCoHost={isParticipantCoHost}
                  hasRaisedHand={participant.hasRaisedHand}
                  isHost={isHost}
                  isViewerFounder={isFounder}
                  onKick={() => kickUser(participant.peerId)}
                  onMute={() => muteUser(participant.peerId)}
                  onApproveHand={participant.hasRaisedHand ? () => approveHand(participant.peerId) : undefined}
                  onAddCoHost={() => addCoHost(participant.peerId)}
                  onRemoveCoHost={() => removeCoHost(participant.peerId)}
                />
              );
            })}
          </div>
        </div>

        {/* Raised hands queue for host */}
        {isHost && listeners.some(p => p.hasRaisedHand) && (
          <div className="mb-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <p className="text-xs text-yellow-400 mb-2 flex items-center gap-1">
              <Hand className="w-3 h-3" /> Requesting to speak
            </p>
            <div className="flex flex-wrap gap-2">
              {listeners.filter(p => p.hasRaisedHand).map(p => (
                <button
                  key={p.peerId}
                  onClick={() => approveHand(p.peerId)}
                  className="px-3 py-1.5 text-xs bg-yellow-500/20 text-yellow-300 rounded-lg hover:bg-yellow-500/30 flex items-center gap-1.5"
                >
                  <Check className="w-3 h-3" />
                  Approve {p.peerId.slice(0, 4)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listeners Section */}
        {(listeners.length > 0 || !isSpeaker) && (
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <Users className="w-3 h-3" /> Listeners ({!isSpeaker ? listeners.length + 1 : listeners.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Self as listener */}
              {!isSpeaker && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">
                    You
                  </div>
                  {hasRaisedHand && <Hand className="w-3 h-3 text-yellow-400" />}
                </div>
              )}

              {/* Other listeners */}
              {listeners.map((p) => (
                <div key={p.peerId} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-[10px] text-white font-bold">
                    {p.peerId.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-400">{p.peerId.slice(0, 4)}...</span>
                  {p.hasRaisedHand && <Hand className="w-3 h-3 text-yellow-400" />}
                </div>
              ))}
            </div>
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

        {/* Mute All button - only for hosts */}
        {isHost && (
          <button
            onClick={muteAll}
            className="p-4 rounded-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 transition-all"
            title="Mute all speakers"
          >
            <VolumeX className="w-6 h-6" />
          </button>
        )}

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
