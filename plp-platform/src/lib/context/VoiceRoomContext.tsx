'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import type { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

export interface VoiceParticipant {
  peerId: string;
  displayName?: string;
  profilePhotoUrl?: string;
  isMuted: boolean;
  isSpeaking: boolean;
  hasRaisedHand: boolean;
  isSpeaker: boolean; // true = speaker, false = listener
}

export const MAX_SPEAKERS = 8;

export interface Reaction {
  id: string;
  emoji: string;
  peerId: string;
}

export const REACTION_EMOJIS = ['👏', '🔥', '💯', '❤️', '😂', '🚀'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

interface VoiceRoomState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;

  // Room info
  marketId: string | null; // URL param ID (MongoDB ID or Solana address)
  marketAddress: string | null;
  marketName: string | null;
  walletAddress: string | null;
  founderWallet: string | null;
  roomTitle: string;

  // Participants
  participants: VoiceParticipant[];
  coHosts: string[];
  tempHostId: string | null; // First speaker becomes temp host if no founder

  // User state
  isMuted: boolean;
  isSpeaking: boolean;
  hasRaisedHand: boolean;
  isSpeaker: boolean; // User's speaker/listener status

  // Speaker management
  speakerCount: number;
  canJoinAsSpeaker: boolean; // true if < MAX_SPEAKERS

  // UI state
  reactions: Reaction[];
  error: string | null;
  isMinimized: boolean;
  showJoinChoice: boolean; // Show speaker/listener choice dialog

  // Computed
  isHost: boolean;
  isFounder: boolean;
  isCoHost: boolean;
  isTempHost: boolean;
}

interface VoiceRoomContextType extends VoiceRoomState {
  // Actions
  join: (marketId: string, marketAddress: string, marketName: string, walletAddress: string, founderWallet: string | null) => Promise<void>;
  joinAsSpeaker: () => void;
  joinAsListener: () => void;
  leave: () => void;
  toggleMute: () => void;
  toggleHand: () => void;
  sendReaction: (emoji: ReactionEmoji) => void;
  kickUser: (peerId: string) => void;
  muteUser: (peerId: string) => void;
  muteAll: () => void;
  updateRoomTitle: (title: string) => void;
  approveHand: (peerId: string) => void;
  promoteToSpeaker: (peerId: string) => void;
  demoteToListener: (peerId: string) => void;
  addCoHost: (peerId: string) => void;
  removeCoHost: (peerId: string) => void;
  setMinimized: (minimized: boolean) => void;
  expandToRoom: () => void;
  cancelJoinChoice: () => void;
}

const VoiceRoomContext = createContext<VoiceRoomContextType | null>(null);

export function useVoiceRoomContext() {
  const context = useContext(VoiceRoomContext);
  if (!context) {
    throw new Error('useVoiceRoomContext must be used within VoiceRoomProvider');
  }
  return context;
}

export function useVoiceRoomContextSafe() {
  return useContext(VoiceRoomContext);
}

interface VoiceRoomProviderProps {
  children: ReactNode;
}

export function VoiceRoomProvider({ children }: VoiceRoomProviderProps) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Room info
  const [marketId, setMarketId] = useState<string | null>(null); // URL param ID (MongoDB ID or Solana address)
  const [marketAddress, setMarketAddress] = useState<string | null>(null);
  const [marketName, setMarketName] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [founderWallet, setFounderWallet] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState('');

  // Participants
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [coHosts, setCoHosts] = useState<string[]>([]);
  const [tempHostId, setTempHostId] = useState<string | null>(null);

  // User state
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Speaker management
  const [speakerCount, setSpeakerCount] = useState(0);

  // UI state
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showJoinChoice, setShowJoinChoice] = useState(false);

  // Pending join data (stored while showing choice dialog)
  const pendingJoinRef = useRef<{
    marketAddress: string;
    marketName: string;
    walletAddress: string;
    founderWallet: string | null;
  } | null>(null);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producerRef = useRef<Producer | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(false);
  const maxReconnectAttempts = 5;

  // Computed values
  const isFounder = walletAddress === founderWallet;
  const isCoHost = walletAddress ? coHosts.includes(walletAddress) : false;
  const isTempHost = walletAddress === tempHostId && !isFounder;
  const isHost = isFounder || isCoHost || isTempHost;
  const canJoinAsSpeaker = speakerCount < MAX_SPEAKERS;

  const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'http://localhost:3002';

  const cleanup = useCallback((intentional = true) => {
    if (intentional) {
      shouldReconnectRef.current = false;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;

    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    producerRef.current?.close();
    producerRef.current = null;

    consumersRef.current.forEach(consumer => consumer.close());
    consumersRef.current.clear();

    audioElementsRef.current.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;

    socketRef.current?.disconnect();
    socketRef.current = null;

    deviceRef.current = null;
    setIsConnected(false);
    setIsSpeaking(false);
    setParticipants([]);
    setRoomTitle('');
    setCoHosts([]);
    setHasRaisedHand(false);
    setTempHostId(null);
    setSpeakerCount(0);

    if (intentional) {
      setMarketId(null);
      setMarketAddress(null);
      setMarketName(null);
      setWalletAddress(null);
      setFounderWallet(null);
      setReconnectAttempts(0);
      setIsReconnecting(false);
      setIsMinimized(false);
      setError(null);
      setIsSpeaker(false);
      setShowJoinChoice(false);
      pendingJoinRef.current = null;
    }
  }, []);

  const consumeProducer = useCallback(async (producerId: string, peerId: string) => {
    if (!socketRef.current || !deviceRef.current || !recvTransportRef.current) return;

    socketRef.current.emit('consume', {
      producerId,
      rtpCapabilities: deviceRef.current.rtpCapabilities,
    }, async (response: any) => {
      if (response.error) {
        console.error('Consume error:', response.error);
        return;
      }

      const consumer = await recvTransportRef.current!.consume({
        id: response.id,
        producerId: response.producerId,
        kind: response.kind,
        rtpParameters: response.rtpParameters,
      });

      consumersRef.current.set(producerId, consumer);

      const audio = new Audio();
      audio.srcObject = new MediaStream([consumer.track]);
      audio.autoplay = true;
      audioElementsRef.current.set(producerId, audio);

      setParticipants(prev => {
        if (prev.find(p => p.peerId === peerId)) return prev;
        return [...prev, { peerId, isMuted: false, isSpeaking: false, hasRaisedHand: false, isSpeaker: true }];
      });
    });
  }, []);

  // Internal join function that actually connects
  const doJoin = useCallback(async (joinAsSpeaker: boolean) => {
    const pending = pendingJoinRef.current;
    if (!pending || isConnected || isConnecting) return;

    const { marketAddress: newMarketAddress, marketName: newMarketName, walletAddress: newWalletAddress, founderWallet: newFounderWallet } = pending;

    setMarketAddress(newMarketAddress);
    setMarketName(newMarketName);
    setWalletAddress(newWalletAddress);
    setFounderWallet(newFounderWallet);
    setIsConnecting(true);
    setShowJoinChoice(false);
    setError(null);

    // Founder always joins as speaker
    const willBeSpeaker = newWalletAddress === newFounderWallet || joinAsSpeaker;
    setIsSpeaker(willBeSpeaker);

    try {
      // Enhanced audio constraints for better voice quality
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        }
      });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(track => track.enabled = false);

      const socket = io(VOICE_SERVER_URL, { transports: ['websocket'] });
      socketRef.current = socket;

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (err) => reject(err));
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      const joinResponse = await new Promise<any>((resolve, reject) => {
        socket.emit('joinRoom', {
          roomId: newMarketAddress,
          peerId: newWalletAddress,
        }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve(response);
        });
      });

      const device = new Device();
      await device.load({ routerRtpCapabilities: joinResponse.rtpCapabilities });
      deviceRef.current = device;

      const sendTransport = device.createSendTransport(joinResponse.sendTransportOptions);
      sendTransportRef.current = sendTransport;

      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit('connectTransport', {
          transportId: sendTransport.id,
          dtlsParameters,
        }, (response: any) => {
          if (response.error) errback(new Error(response.error));
          else callback();
        });
      });

      sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        socket.emit('produce', { kind, rtpParameters }, (response: any) => {
          if (response.error) errback(new Error(response.error));
          else callback({ id: response.id });
        });
      });

      const recvTransport = device.createRecvTransport(joinResponse.recvTransportOptions);
      recvTransportRef.current = recvTransport;

      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit('connectTransport', {
          transportId: recvTransport.id,
          dtlsParameters,
        }, (response: any) => {
          if (response.error) errback(new Error(response.error));
          else callback();
        });
      });

      const track = stream.getAudioTracks()[0];
      // Produce with higher quality Opus codec settings
      const producer = await sendTransport.produce({
        track,
        codecOptions: {
          opusStereo: false,
          opusDtx: true, // Discontinuous transmission - saves bandwidth during silence
          opusFec: true, // Forward error correction for better quality on lossy connections
          opusMaxPlaybackRate: 48000,
        },
        encodings: [
          { maxBitrate: 64000 } // 64kbps for voice (default is often 32kbps)
        ],
      });
      producerRef.current = producer;

      socket.emit('getProducers', (response: any) => {
        response.producers?.forEach((p: any) => {
          consumeProducer(p.producerId, p.peerId);
        });
      });

      socket.on('newProducer', ({ producerId, peerId }) => {
        consumeProducer(producerId, peerId);
      });

      socket.on('peerLeft', ({ peerId }) => {
        setParticipants(prev => prev.filter(p => p.peerId !== peerId));
      });

      socket.on('handRaised', ({ peerId }) => {
        setParticipants(prev =>
          prev.map(p => p.peerId === peerId ? { ...p, hasRaisedHand: true } : p)
        );
      });

      socket.on('handLowered', ({ peerId }) => {
        setParticipants(prev =>
          prev.map(p => p.peerId === peerId ? { ...p, hasRaisedHand: false } : p)
        );
      });

      socket.on('reaction', ({ peerId, emoji }) => {
        const reactionId = `${peerId}-${Date.now()}-${Math.random()}`;
        setReactions(prev => [...prev, { id: reactionId, emoji, peerId }]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== reactionId));
        }, 3000);
      });

      socket.on('speakingChanged', ({ peerId, isSpeaking: speaking }) => {
        setParticipants(prev =>
          prev.map(p => p.peerId === peerId ? { ...p, isSpeaking: speaking } : p)
        );
      });

      socket.on('roomTitleChanged', ({ title }) => {
        setRoomTitle(title);
      });

      socket.on('kicked', () => {
        cleanup();
        setError('You have been removed from the room');
      });

      socket.on('forceMuted', () => {
        localStreamRef.current?.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
        setIsMuted(true);
      });

      socket.on('coHostAdded', ({ peerId }) => {
        setCoHosts(prev => [...prev, peerId]);
      });

      socket.on('coHostRemoved', ({ peerId }) => {
        setCoHosts(prev => prev.filter(id => id !== peerId));
      });

      // Listen for speaker role changes from server
      socket.on('promotedToSpeaker', ({ peerId }) => {
        if (peerId === newWalletAddress) {
          // Self was promoted
          setIsSpeaker(true);
          setHasRaisedHand(false);
        }
        setParticipants(prev =>
          prev.map(p =>
            p.peerId === peerId ? { ...p, isSpeaker: true, hasRaisedHand: false } : p
          )
        );
        setSpeakerCount(prev => prev + 1);
      });

      socket.on('demotedToListener', ({ peerId }) => {
        if (peerId === newWalletAddress) {
          // Self was demoted
          setIsSpeaker(false);
        }
        setParticipants(prev =>
          prev.map(p =>
            p.peerId === peerId ? { ...p, isSpeaker: false } : p
          )
        );
        setSpeakerCount(prev => Math.max(0, prev - 1));
      });

      // Listen for temp host changes
      socket.on('tempHostChanged', ({ peerId }) => {
        setTempHostId(peerId);
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);

        if (shouldReconnectRef.current && reason !== 'io client disconnect') {
          setIsReconnecting(true);
          const attempt = reconnectAttempts + 1;
          setReconnectAttempts(attempt);

          if (attempt <= maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
            console.log(`Reconnecting in ${delay}ms (attempt ${attempt}/${maxReconnectAttempts})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              cleanup(false);
              if (marketId && marketAddress && walletAddress) {
                join(marketId, marketAddress, marketName || '', walletAddress, founderWallet);
              }
            }, delay);
          } else {
            setIsReconnecting(false);
            setError('Connection lost. Please rejoin the room.');
          }
        }
      });

      shouldReconnectRef.current = true;

      // Speaking detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      speakingIntervalRef.current = setInterval(() => {
        if (!analyserRef.current || isMuted) {
          if (wasSpeaking) {
            wasSpeaking = false;
            setIsSpeaking(false);
            socketRef.current?.emit('speakingChanged', { isSpeaking: false });
          }
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const speaking = average > 20;

        if (speaking !== wasSpeaking) {
          wasSpeaking = speaking;
          setIsSpeaking(speaking);
          socketRef.current?.emit('speakingChanged', { isSpeaking: speaking });
        }
      }, 100);

      // Process existing peers
      let currentSpeakerCount = 0;
      joinResponse.peers?.forEach((peer: any) => {
        const peerIsSpeaker = peer.isSpeaker !== false; // Default to speaker for backwards compat
        if (peerIsSpeaker) currentSpeakerCount++;
        setParticipants(prev => {
          if (prev.find(p => p.peerId === peer.id)) return prev;
          return [...prev, { peerId: peer.id, isMuted: false, isSpeaking: false, hasRaisedHand: false, isSpeaker: peerIsSpeaker }];
        });
      });

      // Set temp host if no founder and this is first speaker
      if (willBeSpeaker && currentSpeakerCount === 0 && newWalletAddress !== newFounderWallet) {
        setTempHostId(newWalletAddress);
      }

      // Update speaker count
      setSpeakerCount(currentSpeakerCount + (willBeSpeaker ? 1 : 0));

      setIsConnected(true);
      setIsMuted(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);

      // If founder joins, send notification to all voters (fire and forget)
      if (newWalletAddress === newFounderWallet) {
        fetch('/api/voice/founder-joined', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketAddress: newMarketAddress,
            marketName: newMarketName,
            founderWallet: newFounderWallet,
            walletAddress: newWalletAddress,
          }),
        }).catch(err => console.error('Failed to send founder notification:', err));
      }
    } catch (err: any) {
      console.error('Join error:', err);
      setError(err.message || 'Failed to join voice room');
      cleanup();
    } finally {
      setIsConnecting(false);
      pendingJoinRef.current = null;
    }
  }, [isConnected, isConnecting, cleanup, consumeProducer, VOICE_SERVER_URL, isMuted]);

  // Public join function - shows choice dialog or auto-joins
  const join = useCallback(async (
    newMarketId: string,
    newMarketAddress: string,
    newMarketName: string,
    newWalletAddress: string,
    newFounderWallet: string | null
  ) => {
    if (isConnected || isConnecting) return;

    // Store the URL ID for navigation/comparison
    setMarketId(newMarketId);

    // Store pending join data
    pendingJoinRef.current = {
      marketAddress: newMarketAddress,
      marketName: newMarketName,
      walletAddress: newWalletAddress,
      founderWallet: newFounderWallet,
    };

    // Founder always joins as speaker automatically
    if (newWalletAddress === newFounderWallet) {
      doJoin(true);
      return;
    }

    // TODO: Get actual speaker count from server
    // For now, show choice dialog if potentially room for speakers
    setShowJoinChoice(true);
  }, [isConnected, isConnecting, doJoin]);

  const joinAsSpeaker = useCallback(() => {
    doJoin(true);
  }, [doJoin]);

  const joinAsListener = useCallback(() => {
    doJoin(false);
  }, [doJoin]);

  const cancelJoinChoice = useCallback(() => {
    setShowJoinChoice(false);
    pendingJoinRef.current = null;
  }, []);

  const leave = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;

    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !newMuted;
    });
    setIsMuted(newMuted);
  }, [isMuted]);

  const raiseHand = useCallback(() => {
    if (!socketRef.current || hasRaisedHand) return;
    socketRef.current.emit('raiseHand');
    setHasRaisedHand(true);
  }, [hasRaisedHand]);

  const lowerHand = useCallback(() => {
    if (!socketRef.current || !hasRaisedHand) return;
    socketRef.current.emit('lowerHand');
    setHasRaisedHand(false);
  }, [hasRaisedHand]);

  const toggleHand = useCallback(() => {
    if (hasRaisedHand) {
      lowerHand();
    } else {
      raiseHand();
    }
  }, [hasRaisedHand, raiseHand, lowerHand]);

  const sendReaction = useCallback((emoji: ReactionEmoji) => {
    if (!socketRef.current || !walletAddress) return;
    socketRef.current.emit('reaction', { emoji });
    const reactionId = `${walletAddress}-${Date.now()}-${Math.random()}`;
    setReactions(prev => [...prev, { id: reactionId, emoji, peerId: walletAddress }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== reactionId));
    }, 3000);
  }, [walletAddress]);

  const kickUser = useCallback((peerId: string) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('kickUser', { peerId });
  }, [isHost]);

  const muteUser = useCallback((peerId: string) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('muteUser', { peerId });
  }, [isHost]);

  const updateRoomTitle = useCallback((title: string) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('setRoomTitle', { title });
    setRoomTitle(title);
  }, [isHost]);

  const approveHand = useCallback((peerId: string) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('approveHand', { peerId });
    // Also promote to speaker
    setParticipants(prev =>
      prev.map(p => p.peerId === peerId ? { ...p, hasRaisedHand: false, isSpeaker: true } : p)
    );
    setSpeakerCount(prev => prev + 1);
  }, [isHost]);

  const muteAll = useCallback(() => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('muteAll');
  }, [isHost]);

  const promoteToSpeaker = useCallback((peerId: string) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('promoteToSpeaker', { peerId });
    setParticipants(prev =>
      prev.map(p => p.peerId === peerId ? { ...p, isSpeaker: true, hasRaisedHand: false } : p)
    );
    setSpeakerCount(prev => prev + 1);
  }, [isHost]);

  const demoteToListener = useCallback((peerId: string) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('demoteToListener', { peerId });
    setParticipants(prev =>
      prev.map(p => p.peerId === peerId ? { ...p, isSpeaker: false } : p)
    );
    setSpeakerCount(prev => Math.max(0, prev - 1));
  }, [isHost]);

  const addCoHost = useCallback((peerId: string) => {
    if (!socketRef.current || !isFounder) return;
    socketRef.current.emit('addCoHost', { peerId });
    setCoHosts(prev => [...prev, peerId]);
  }, [isFounder]);

  const removeCoHost = useCallback((peerId: string) => {
    if (!socketRef.current || !isFounder) return;
    socketRef.current.emit('removeCoHost', { peerId });
    setCoHosts(prev => prev.filter(id => id !== peerId));
  }, [isFounder]);

  const expandToRoom = useCallback(() => {
    if (marketId) {
      setIsMinimized(false);
      window.location.href = `/market/${marketId}`;
    }
  }, [marketId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const value: VoiceRoomContextType = {
    // State
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    marketId,
    marketAddress,
    marketName,
    walletAddress,
    founderWallet,
    roomTitle,
    participants,
    coHosts,
    tempHostId,
    isMuted,
    isSpeaking,
    hasRaisedHand,
    isSpeaker,
    speakerCount,
    canJoinAsSpeaker,
    reactions,
    error,
    isMinimized,
    showJoinChoice,
    isHost,
    isFounder,
    isCoHost,
    isTempHost,
    // Actions
    join,
    joinAsSpeaker,
    joinAsListener,
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
    setMinimized: setIsMinimized,
    expandToRoom,
    cancelJoinChoice,
  };

  return (
    <VoiceRoomContext.Provider value={value}>
      {children}
    </VoiceRoomContext.Provider>
  );
}
