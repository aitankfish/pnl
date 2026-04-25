'use client';

import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { Mic, MicOff, PhoneOff, Loader2, Users, AlertCircle, Hand, MoreVertical, UserX, VolumeX, Check, X, Edit2, Share2, Link as LinkIcon, Star, Crown, Wifi, WifiOff, Minimize2 } from 'lucide-react';
import { useVoiceRoomContext, REACTION_EMOJIS, MAX_SPEAKERS } from '@/lib/context/VoiceRoomContext';
import Link from 'next/link';
import { RootIcon, LeafIcon, BloomIcon, SeedIcon, BellflowerIcon, SunIcon } from '@/components/PlantIcons';

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

interface VoiceRoomProps {
  marketId: string; // URL param ID (MongoDB ID or Solana address)
  marketAddress: string;
  marketName?: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
  onMinimize?: () => void; // Callback to minimize/close the voice room panel (mobile)
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

// Check if string looks like a valid Solana wallet address (base58, 32-44 chars)
const isValidWalletAddress = (str: string): boolean => {
  return str.length >= 32 && str.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
};

// Single-row item used inside the host dropdown menu — keeps the cosmic
// styling DRY between approve / mute / co-host / remove rows.
function MenuRow({
  onClick,
  color,
  children,
}: {
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full mono uppercase tracking-[0.18em] text-[0.55rem] px-3 py-2 text-left flex items-center gap-2 transition-colors"
      style={{ color }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = 'rgba(244,238,228,0.04)')
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

// Avatar component for speakers
function SpeakerAvatar({
  address,
  displayName,
  profilePhotoUrl,
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
  displayName?: string;
  profilePhotoUrl?: string;
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
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : address.slice(0, 2).toUpperCase();
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
  const displayLabel = displayName || shortAddress;
  const canLinkToProfile = isValidWalletAddress(address);

  // Cosmic-plant avatar — square hairline tile, color tinted by role.
  // Forest ring when speaking; no animate-pulse (the soft glow tells the story).
  const avatarBg = isSelf
    ? `${AMBER}1a`
    : isFounder
    ? `${AMBER}22`
    : isCoHost
    ? `${PEACH}22`
    : `${HAIR_STRONG}`;
  const avatarBorder = isFounder
    ? `${AMBER}66`
    : isCoHost
    ? `${PEACH}66`
    : isSelf
    ? `${AMBER}55`
    : `${HAIR_STRONG}`;
  const avatarContent = (
    <div
      className={`w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center mono uppercase tracking-[0.06em] text-xs sm:text-sm overflow-hidden transition-all ${
        !isSelf ? 'cursor-pointer hover:opacity-80' : ''
      }`}
      style={{
        background: avatarBg,
        border: `1px solid ${avatarBorder}`,
        color: isFounder ? AMBER : isCoHost ? PEACH : isSelf ? AMBER : CREAM,
        boxShadow: isSpeaking ? `0 0 0 2px ${FOREST}88, 0 0 18px ${FOREST}55` : 'none',
      }}
    >
      {profilePhotoUrl ? (
        <img src={profilePhotoUrl} alt={displayLabel} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-1.5 w-16 sm:w-20 relative">
      {/* Avatar with speaking indicator */}
      <div className="relative">
        {isSelf ? (
          avatarContent
        ) : canLinkToProfile ? (
          <Link href={`/profile/${address}`} title={`View ${displayLabel}'s profile`}>
            {avatarContent}
          </Link>
        ) : (
          avatarContent
        )}
        {/* Founder badge — root plant glyph (the foundation). */}
        {isFounder && !isSelf && (
          <div
            className="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center"
            style={{
              background: AMBER,
              color: BG,
              border: `1px solid ${AMBER}`,
            }}
            title="Founder"
          >
            <RootIcon className="w-3 h-3" />
          </div>
        )}
        {/* Co-host badge — leaf glyph (helps the founder grow). */}
        {isCoHost && !isFounder && !isSelf && (
          <div
            className="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center"
            style={{
              background: PEACH,
              color: BG,
              border: `1px solid ${PEACH}`,
            }}
            title="Co-host"
          >
            <LeafIcon className="w-3 h-3" />
          </div>
        )}
        {/* Raised hand */}
        {hasRaisedHand && (
          <div
            className="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center animate-bounce"
            style={{
              background: AMBER,
              color: BG,
              border: `1px solid ${AMBER}`,
            }}
            title="Hand raised"
          >
            <Hand className="w-3 h-3" />
          </div>
        )}
        {/* Mic status */}
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center"
          style={{
            background: isMuted ? HAIR_STRONG : FOREST,
            color: isMuted ? CREAM_FAINT : CREAM,
            border: `1px solid ${isMuted ? HAIR_STRONG : FOREST}`,
          }}
        >
          {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
        </div>
        {/* Host menu */}
        {isHost && !isSelf && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(10,8,20,0.85)',
              color: CREAM_DIM,
              border: `1px solid ${HAIR_STRONG}`,
            }}
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        )}
        {/* Host dropdown menu — cosmic glass panel */}
        {showMenu && isHost && !isSelf && (
          <div
            className="absolute top-6 right-0 z-10 py-1 min-w-[140px]"
            style={{
              background: 'rgba(10,8,20,0.96)',
              border: `1px solid ${HAIR_STRONG}`,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}
          >
            {hasRaisedHand && onApproveHand && (
              <MenuRow
                onClick={() => { onApproveHand(); setShowMenu(false); }}
                color={FOREST}
              >
                <Check className="w-3 h-3" /> Approve
              </MenuRow>
            )}
            {onMute && (
              <MenuRow
                onClick={() => { onMute(); setShowMenu(false); }}
                color={AMBER}
              >
                <VolumeX className="w-3 h-3" /> Mute
              </MenuRow>
            )}
            {isViewerFounder && !isCoHost && !isFounder && onAddCoHost && (
              <MenuRow
                onClick={() => { onAddCoHost(); setShowMenu(false); }}
                color={PEACH}
              >
                <LeafIcon className="w-3 h-3" /> Make co-host
              </MenuRow>
            )}
            {isViewerFounder && isCoHost && onRemoveCoHost && (
              <MenuRow
                onClick={() => { onRemoveCoHost(); setShowMenu(false); }}
                color={CREAM_DIM}
              >
                <LeafIcon className="w-3 h-3" /> Remove co-host
              </MenuRow>
            )}
            {onKick && (
              <MenuRow
                onClick={() => { onKick(); setShowMenu(false); }}
                color={EARTH}
              >
                <UserX className="w-3 h-3" /> Remove
              </MenuRow>
            )}
          </div>
        )}
      </div>
      {/* Name */}
      {isSelf ? (
        <p
          className="truncate max-w-full"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            fontSize: '0.78rem',
          }}
        >
          You
        </p>
      ) : canLinkToProfile ? (
        <Link
          href={`/profile/${address}`}
          className="truncate max-w-full transition-colors"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontSize: '0.78rem',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM)}
        >
          {displayLabel}
        </Link>
      ) : (
        <p
          className="truncate max-w-full"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontSize: '0.78rem',
          }}
        >
          {displayLabel}
        </p>
      )}
      {/* Role */}
      <p
        className="mono uppercase tracking-[0.22em] text-[0.5rem]"
        style={{ color: CREAM_FAINT }}
      >
        {role}
      </p>
    </div>
  );
}

// Profile data type
interface ProfileData {
  username?: string;
  profilePhotoUrl?: string;
}

export default function VoiceRoom({
  marketId,
  marketAddress,
  marketName,
  walletAddress,
  founderWallet,
  hasPosition,
  onMinimize,
}: VoiceRoomProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [joinToast, setJoinToast] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileData>>({});

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

  const canJoin = !!walletAddress;
  const prevParticipantsRef = useRef<number>(0);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Cleanup timeouts on unmount to prevent state updates after navigation
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  // Handle join with context
  const handleJoin = () => {
    if (walletAddress) {
      join(marketId, marketAddress, marketName || '', walletAddress, founderWallet || null);
    }
  };

  // Fetch profiles for participants
  useEffect(() => {
    const fetchProfiles = async () => {
      // Collect all wallet addresses that need profiles
      const walletsToFetch: string[] = [];

      // Add self wallet if connected
      if (walletAddress && !profiles[walletAddress]) {
        walletsToFetch.push(walletAddress);
      }

      // Add founder wallet
      if (founderWallet && !profiles[founderWallet]) {
        walletsToFetch.push(founderWallet);
      }

      // Add participant wallets
      participants.forEach(p => {
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

    if (isConnected) {
      fetchProfiles();
    }
  }, [isConnected, participants, walletAddress, founderWallet]);

  // Join notification effect
  useEffect(() => {
    if (isConnected && participants.length > prevParticipantsRef.current) {
      // Someone joined
      const latestParticipant = participants[participants.length - 1];
      const profile = latestParticipant ? profiles[latestParticipant.peerId] : null;
      const displayName = profile?.username ||
        (latestParticipant ? `${latestParticipant.peerId.slice(0, 4)}...${latestParticipant.peerId.slice(-4)}` : 'Someone');

      setJoinToast(`${displayName} joined the room`);

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
      const toastTimeout = setTimeout(() => {
        setJoinToast(null);
        timeoutsRef.current.delete(toastTimeout);
      }, 3000);
      timeoutsRef.current.add(toastTimeout);
    }
    prevParticipantsRef.current = participants.length;
  }, [participants.length, isConnected, profiles]);

  const handleShareLink = async () => {
    const roomUrl = `${window.location.origin}/market/${marketAddress}`;
    try {
      await navigator.clipboard.writeText(roomUrl);
      setShowCopied(true);
      const copiedTimeout = setTimeout(() => {
        setShowCopied(false);
        timeoutsRef.current.delete(copiedTimeout);
      }, 2000);
      timeoutsRef.current.add(copiedTimeout);
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

  // Join choice dialog — cosmic editorial
  if (showJoinChoice) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-8 space-y-5">
        <div
          className="w-14 h-14 flex items-center justify-center"
          style={{ background: `${AMBER}1a`, border: `1px solid ${AMBER}55`, color: AMBER }}
        >
          <BellflowerIcon className="w-7 h-7" />
        </div>

        <div className="text-center">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-2"
            style={{ color: AMBER }}
          >
            The circle gathers
          </p>
          <h3
            className="mb-1"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '1.3rem',
              fontWeight: 350,
            }}
          >
            How will you join?
          </h3>
          <p
            className="italic max-w-xs mx-auto"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.85rem',
            }}
          >
            {canJoinAsSpeaker
              ? `${MAX_SPEAKERS - speakerCount} speaker slots open`
              : 'All speaker slots are full — you can listen and raise a hand.'}
          </p>
        </div>

        <div className="w-full max-w-xs space-y-2">
          {canJoinAsSpeaker && (
            <button
              onClick={joinAsSpeaker}
              className="w-full mono uppercase tracking-[0.26em] text-[0.65rem] py-3 px-4 inline-flex items-center justify-center gap-2 transition-colors"
              style={{ background: FOREST, color: CREAM }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#4a8d4d')}
              onMouseLeave={(e) => (e.currentTarget.style.background = FOREST)}
            >
              <Mic className="w-3.5 h-3.5" />
              Join as speaker
            </button>
          )}

          <button
            onClick={joinAsListener}
            className="w-full mono uppercase tracking-[0.26em] text-[0.65rem] py-3 px-4 inline-flex items-center justify-center gap-2 transition-colors"
            style={{ color: CREAM, border: `1px solid ${HAIR_STRONG}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = AMBER + '88';
              e.currentTarget.style.color = AMBER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = HAIR_STRONG;
              e.currentTarget.style.color = CREAM;
            }}
          >
            <Users className="w-3.5 h-3.5" />
            Join as listener
          </button>

          <button
            onClick={cancelJoinChoice}
            className="w-full mono uppercase tracking-[0.22em] text-[0.55rem] py-2 transition-colors"
            style={{ color: CREAM_FAINT }}
            onMouseEnter={(e) => (e.currentTarget.style.color = CREAM_DIM)}
            onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
          >
            Cancel
          </button>
        </div>

        <p
          className="italic text-center max-w-xs"
          style={{
            color: CREAM_FAINT,
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            fontSize: '0.75rem',
          }}
        >
          Listeners can raise a hand to request the floor.
        </p>
      </div>
    );
  }

  // Not connected state — cosmic invitation
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-8 space-y-5">
        <div
          className="w-14 h-14 flex items-center justify-center"
          style={{ background: `${AMBER}1a`, border: `1px solid ${AMBER}55`, color: AMBER }}
        >
          <BellflowerIcon className="w-7 h-7" />
        </div>

        <div className="text-center">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-2"
            style={{ color: AMBER }}
          >
            Voice circle
          </p>
          <h3
            className="mb-2"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '1.3rem',
              fontWeight: 350,
            }}
          >
            Tune in.
          </h3>
          <p
            className="italic max-w-xs mx-auto"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            Live voice with the community discussing this project.
          </p>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 px-3 py-2 max-w-xs"
            style={{ background: 'rgba(214,115,71,0.08)', border: `1px solid ${EARTH}55` }}
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: EARTH }} />
            <span
              className="text-xs"
              style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}
            >
              {error}
            </span>
          </div>
        )}

        <p
          className="mono uppercase tracking-[0.22em] text-[0.55rem]"
          style={{ color: CREAM_FAINT }}
        >
          Your mic stays off until you choose
        </p>

        {!walletAddress ? (
          <div
            className="w-full max-w-xs px-4 py-3 text-center"
            style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR_STRONG}` }}
          >
            <span
              className="mono uppercase tracking-[0.22em] text-[0.6rem]"
              style={{ color: CREAM_DIM }}
            >
              Connect a wallet to join
            </span>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={isConnecting}
            className="w-full max-w-xs mono uppercase tracking-[0.26em] text-[0.65rem] py-3 px-4 inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
            style={{ background: AMBER, color: BG }}
            onMouseEnter={(e) => {
              if (!isConnecting) e.currentTarget.style.background = PEACH;
            }}
            onMouseLeave={(e) => {
              if (!isConnecting) e.currentTarget.style.background = AMBER;
            }}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Connecting…
              </>
            ) : (
              <>Join voice circle</>
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
        <div
          className="absolute top-0 left-0 right-0 z-30 px-4 py-2"
          style={{ background: AMBER, color: BG }}
        >
          <div className="flex items-center justify-center gap-2 mono uppercase tracking-[0.22em] text-[0.55rem]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Reconnecting · attempt {reconnectAttempts}/5
          </div>
        </div>
      )}

      {/* Join toast */}
      {joinToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-fade-in">
          <div
            className="px-3 py-1.5 inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.55rem]"
            style={{
              background: 'rgba(10,8,20,0.94)',
              border: `1px solid ${HAIR_STRONG}`,
              backdropFilter: 'blur(8px)',
              color: CREAM,
            }}
          >
            <span
              className="w-1.5 h-1.5"
              style={{ background: FOREST, boxShadow: `0 0 6px ${FOREST}` }}
            />
            {joinToast}
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="flex flex-col px-4 py-3"
        style={{ borderBottom: `1px solid ${HAIR}` }}
      >
        <div className="flex items-center justify-between">
          <div className="mono uppercase tracking-[0.26em] text-[0.6rem] inline-flex items-center gap-2">
            <span
              className="w-1.5 h-1.5"
              style={{
                background: FOREST,
                boxShadow: `0 0 6px ${FOREST}`,
                animation: 'beatLive 1.4s ease-in-out infinite',
              }}
              aria-hidden
            />
            <span style={{ color: FOREST }}>Live</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1.5"
              style={{ color: CREAM_FAINT }}
            >
              <Users className="w-3 h-3" />
              {participants.length + 1} listening
            </div>
            <button
              onClick={handleShareLink}
              className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1.5 px-2 py-1 transition-colors"
              style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = CREAM;
                e.currentTarget.style.borderColor = AMBER + '66';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = CREAM_DIM;
                e.currentTarget.style.borderColor = HAIR_STRONG;
              }}
              title="Share room link"
            >
              {showCopied ? (
                <>
                  <Check className="w-3 h-3" style={{ color: FOREST }} />
                  <span style={{ color: FOREST }}>Copied</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-3 h-3" />
                  Share
                </>
              )}
            </button>
            {onMinimize && (
              <button
                onClick={onMinimize}
                className="lg:hidden inline-flex items-center justify-center p-1.5 transition-colors"
                style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
                onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
                title="Minimize voice room"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {/* Room title — Fraunces serif */}
        {isEditingTitle ? (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="What's the topic?"
              className="flex-1 px-3 py-1.5 text-sm focus:outline-none transition-colors"
              style={{
                background: 'transparent',
                color: CREAM,
                border: `1px solid ${HAIR_STRONG}`,
                fontFamily: 'var(--font-fraunces, serif)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = AMBER)}
              onBlur={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
              maxLength={50}
              autoFocus
            />
            <button
              onClick={handleSaveTitle}
              className="p-1.5 transition-colors"
              style={{ color: FOREST, border: `1px solid ${FOREST}55` }}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsEditingTitle(false)}
              className="p-1.5 transition-colors"
              style={{ color: EARTH, border: `1px solid ${EARTH}55` }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : roomTitle ? (
          <div className="flex items-center gap-2 mt-2">
            <p
              className="truncate flex-1"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '0.95rem',
              }}
            >
              {roomTitle}
            </p>
            {isHost && (
              <button
                onClick={() => { setTitleInput(roomTitle); setIsEditingTitle(true); }}
                className="p-1 transition-colors"
                style={{ color: CREAM_FAINT }}
                onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
                onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : isHost ? (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="mt-2 mono uppercase tracking-[0.22em] text-[0.55rem] text-left transition-colors"
            style={{ color: CREAM_FAINT }}
            onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
            onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
          >
            + Set the topic
          </button>
        ) : null}
      </div>

      {/* Speakers Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Speakers Section */}
        <div className="mb-4">
          <p
            className="mono uppercase tracking-[0.26em] text-[0.55rem] mb-3 flex items-center gap-2"
            style={{ color: AMBER }}
          >
            <Mic className="w-3 h-3" />
            Speakers
            <span style={{ color: CREAM_FAINT }}>
              · {isSpeaker ? speakers.length + 1 : speakers.length}/{MAX_SPEAKERS}
            </span>
          </p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {/* Self - only show in speakers if isSpeaker */}
            {isSpeaker && walletAddress && (
              <SpeakerAvatar
                address={walletAddress}
                displayName={profiles[walletAddress]?.username}
                profilePhotoUrl={profiles[walletAddress]?.profilePhotoUrl}
                role={isFounder ? 'Host' : isTempHost ? 'Host' : coHosts.includes(walletAddress) ? 'Co-host' : 'Speaker'}
                isMuted={isMuted}
                isSpeaking={isSpeaking}
                isSelf={true}
                isFounder={isFounder}
                isCoHost={coHosts.includes(walletAddress)}
                hasRaisedHand={hasRaisedHand}
              />
            )}

            {/* Other speakers */}
            {speakers.map((participant) => {
              const isParticipantFounder = participant.peerId === founderWallet;
              const isParticipantCoHost = coHosts.includes(participant.peerId);
              const participantRole = isParticipantFounder ? 'Host' : isParticipantCoHost ? 'Co-host' : 'Speaker';
              const participantProfile = profiles[participant.peerId];

              return (
                <SpeakerAvatar
                  key={participant.peerId}
                  address={participant.peerId}
                  displayName={participantProfile?.username}
                  profilePhotoUrl={participantProfile?.profilePhotoUrl}
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

        {/* Raised hands queue — host only */}
        {isHost && listeners.some(p => p.hasRaisedHand) && (
          <div
            className="mb-4 p-3"
            style={{ background: `${AMBER}0d`, border: `1px solid ${AMBER}55` }}
          >
            <p
              className="mono uppercase tracking-[0.26em] text-[0.55rem] mb-2 flex items-center gap-2"
              style={{ color: AMBER }}
            >
              <Hand className="w-3 h-3" />
              Requesting the floor
            </p>
            <div className="flex flex-wrap gap-1.5">
              {listeners.filter(p => p.hasRaisedHand).map(p => {
                const pProfile = profiles[p.peerId];
                const pName = pProfile?.username || `${p.peerId.slice(0, 4)}...`;
                return (
                  <button
                    key={p.peerId}
                    onClick={() => approveHand(p.peerId)}
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2.5 py-1.5 inline-flex items-center gap-1.5 transition-colors"
                    style={{ color: AMBER, border: `1px solid ${AMBER}55`, background: `${AMBER}11` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `${AMBER}22`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = `${AMBER}11`)}
                  >
                    <Check className="w-3 h-3" />
                    <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>
                      Approve {pName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Listeners */}
        {(listeners.length > 0 || !isSpeaker) && (
          <div className="pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
            <p
              className="mono uppercase tracking-[0.26em] text-[0.55rem] mb-2 flex items-center gap-2"
              style={{ color: CREAM_DIM }}
            >
              <Users className="w-3 h-3" />
              Listeners
              <span style={{ color: CREAM_FAINT }}>
                · {!isSpeaker ? listeners.length + 1 : listeners.length}
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {/* Self as listener */}
              {!isSpeaker && walletAddress && (
                <div
                  className="flex items-center gap-1.5 px-2 py-1"
                  style={{
                    background: `${AMBER}11`,
                    border: `1px solid ${AMBER}44`,
                  }}
                >
                  <div
                    className="w-5 h-5 flex items-center justify-center mono text-[0.5rem] overflow-hidden"
                    style={{ background: `${AMBER}33`, color: AMBER }}
                  >
                    {profiles[walletAddress]?.profilePhotoUrl ? (
                      <img
                        src={profiles[walletAddress].profilePhotoUrl}
                        alt="You"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      'YO'
                    )}
                  </div>
                  <span
                    className="italic"
                    style={{
                      color: CREAM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontStyle: 'italic',
                      fontSize: '0.7rem',
                    }}
                  >
                    you
                  </span>
                  {hasRaisedHand && <Hand className="w-3 h-3" style={{ color: AMBER }} />}
                </div>
              )}

              {/* Other listeners */}
              {listeners.map((p) => {
                const lProfile = profiles[p.peerId];
                const lInitials =
                  lProfile?.username?.slice(0, 2).toUpperCase() ||
                  p.peerId.slice(0, 2).toUpperCase();
                const lName = lProfile?.username || `${p.peerId.slice(0, 4)}...`;
                const canLink = isValidWalletAddress(p.peerId);

                const listenerContent = (
                  <>
                    <div
                      className="w-5 h-5 flex items-center justify-center mono text-[0.5rem] overflow-hidden"
                      style={{ background: HAIR_STRONG, color: CREAM_DIM }}
                    >
                      {lProfile?.profilePhotoUrl ? (
                        <img
                          src={lProfile.profilePhotoUrl}
                          alt={lName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        lInitials
                      )}
                    </div>
                    <span
                      style={{
                        color: CREAM_DIM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontSize: '0.7rem',
                      }}
                    >
                      {lName}
                    </span>
                    {p.hasRaisedHand && (
                      <Hand className="w-3 h-3" style={{ color: AMBER }} />
                    )}
                  </>
                );

                return canLink ? (
                  <Link
                    key={p.peerId}
                    href={`/profile/${p.peerId}`}
                    className="flex items-center gap-1.5 px-2 py-1 transition-colors"
                    style={{
                      background: 'rgba(244,238,228,0.025)',
                      border: `1px solid ${HAIR}`,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = AMBER + '55')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = HAIR)
                    }
                    title={`View ${lName}'s profile`}
                  >
                    {listenerContent}
                  </Link>
                ) : (
                  <div
                    key={p.peerId}
                    className="flex items-center gap-1.5 px-2 py-1"
                    style={{
                      background: 'rgba(244,238,228,0.025)',
                      border: `1px solid ${HAIR}`,
                    }}
                  >
                    {listenerContent}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reaction strip */}
      <div
        className="flex items-center justify-center gap-1 px-4 py-2"
        style={{ borderTop: `1px solid ${HAIR}` }}
      >
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="p-2 active:scale-90 transition-all"
            style={{ color: CREAM_DIM }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,238,228,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title={`React with ${emoji}`}
          >
            <span className="text-lg">{emoji}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div
        className="flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4"
        style={{ borderTop: `1px solid ${HAIR}` }}
      >
        {/* Mute toggle — forest when live, hairline cosmic when muted (with explicit "Muted" hint) */}
        <button
          onClick={toggleMute}
          className="p-3.5 transition-colors inline-flex items-center justify-center gap-2"
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
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Hand-raise toggle */}
        <button
          onClick={toggleHand}
          className="p-3.5 transition-colors"
          style={{
            background: hasRaisedHand ? AMBER : 'transparent',
            color: hasRaisedHand ? BG : CREAM_DIM,
            border: `1px solid ${hasRaisedHand ? AMBER : HAIR_STRONG}`,
          }}
          onMouseEnter={(e) => {
            if (hasRaisedHand) {
              e.currentTarget.style.background = PEACH;
            } else {
              e.currentTarget.style.color = CREAM;
              e.currentTarget.style.borderColor = AMBER + '88';
            }
          }}
          onMouseLeave={(e) => {
            if (hasRaisedHand) {
              e.currentTarget.style.background = AMBER;
            } else {
              e.currentTarget.style.color = CREAM_DIM;
              e.currentTarget.style.borderColor = HAIR_STRONG;
            }
          }}
          title={hasRaisedHand ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Mute-all — host only */}
        {isHost && (
          <button
            onClick={muteAll}
            className="p-3.5 transition-colors"
            style={{ color: PEACH, border: `1px solid ${PEACH}55` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${PEACH}11`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Mute all speakers"
          >
            <VolumeX className="w-5 h-5" />
          </button>
        )}

        {/* Leave */}
        <button
          onClick={leave}
          className="mono uppercase tracking-[0.24em] text-[0.6rem] px-4 py-2.5 inline-flex items-center gap-2 transition-colors"
          style={{ color: EARTH, border: `1px solid ${EARTH}66` }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${EARTH}11`;
            e.currentTarget.style.color = CREAM;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = EARTH;
          }}
        >
          <PhoneOff className="w-4 h-4" />
          Leave
        </button>
      </div>

      <style jsx>{`
        @keyframes beatLive {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
