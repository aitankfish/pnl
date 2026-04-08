'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import type { Transport, Producer, Consumer, RtpCapabilities } from 'mediasoup-client/lib/types';

export interface VoiceParticipant {
  peerId: string;
  displayName?: string;
  isMuted: boolean;
  isSpeaking: boolean;
  hasRaisedHand: boolean;
}

export interface Reaction {
  id: string;
  emoji: string;
  peerId: string;
}

export const REACTION_EMOJIS = ['👏', '🔥', '💯', '❤️', '😂', '🚀'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

interface UseVoiceRoomProps {
  marketAddress: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
}

export function useVoiceRoom({ marketAddress, walletAddress, founderWallet }: UseVoiceRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [coHosts, setCoHosts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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
  const isMountedRef = useRef(true);
  const reactionTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const maxReconnectAttempts = 5;

  const isFounder = walletAddress === founderWallet;
  const isCoHost = walletAddress ? coHosts.includes(walletAddress) : false;
  const isHost = isFounder || isCoHost;

  const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'http://localhost:3002';

  const cleanup = useCallback((intentional = true) => {
    // If intentional leave, don't reconnect
    if (intentional) {
      shouldReconnectRef.current = false;
      isMountedRef.current = false;
    }

    // Clear all reaction timeouts
    reactionTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    reactionTimeoutsRef.current.clear();

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Stop speaking detection
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    // Close audio context
    audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;

    // Stop local stream
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    // Close producer
    producerRef.current?.close();
    producerRef.current = null;

    // Close consumers
    consumersRef.current.forEach(consumer => consumer.close());
    consumersRef.current.clear();

    // Remove audio elements
    audioElementsRef.current.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    // Close transports
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;

    // Disconnect socket
    socketRef.current?.disconnect();
    socketRef.current = null;

    deviceRef.current = null;
    setIsConnected(false);
    setIsSpeaking(false);
    setParticipants([]);
    setRoomTitle('');
    setCoHosts([]);
    if (intentional) {
      setReconnectAttempts(0);
      setIsReconnecting(false);
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

      // Create audio element
      const audio = new Audio();
      audio.srcObject = new MediaStream([consumer.track]);
      audio.autoplay = true;
      audioElementsRef.current.set(producerId, audio);

      // Add participant
      setParticipants(prev => {
        if (prev.find(p => p.peerId === peerId)) return prev;
        return [...prev, { peerId, isMuted: false, isSpeaking: false, hasRaisedHand: false }];
      });
    });
  }, []);

  const join = useCallback(async () => {
    if (!walletAddress || isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Mute by default
      stream.getAudioTracks().forEach(track => track.enabled = false);

      // Connect to voice server
      const socket = io(VOICE_SERVER_URL, { transports: ['websocket'] });
      socketRef.current = socket;

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (err) => reject(err));
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      // Join room
      const joinResponse = await new Promise<any>((resolve, reject) => {
        socket.emit('joinRoom', {
          roomId: marketAddress,
          peerId: walletAddress,
        }, (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve(response);
        });
      });

      // Create mediasoup device
      const device = new Device();
      await device.load({ routerRtpCapabilities: joinResponse.rtpCapabilities });
      deviceRef.current = device;

      // Create send transport
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

      // Create recv transport
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

      // Produce audio (muted)
      const track = stream.getAudioTracks()[0];
      const producer = await sendTransport.produce({ track });
      producerRef.current = producer;

      // Get existing producers
      socket.emit('getProducers', (response: any) => {
        response.producers?.forEach((p: any) => {
          consumeProducer(p.producerId, p.peerId);
        });
      });

      // Listen for new producers
      socket.on('newProducer', ({ producerId, peerId }) => {
        consumeProducer(producerId, peerId);
      });

      // Listen for peer left
      socket.on('peerLeft', ({ peerId }) => {
        setParticipants(prev => prev.filter(p => p.peerId !== peerId));
      });

      // Listen for hand raise events
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

      // Listen for reactions
      socket.on('reaction', ({ peerId, emoji }) => {
        const reactionId = `${peerId}-${Date.now()}-${Math.random()}`;
        setReactions(prev => [...prev, { id: reactionId, emoji, peerId }]);
        // Auto-remove reaction after animation
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== reactionId));
        }, 3000);
      });

      // Listen for speaking state changes
      socket.on('speakingChanged', ({ peerId, isSpeaking: speaking }) => {
        setParticipants(prev =>
          prev.map(p => p.peerId === peerId ? { ...p, isSpeaking: speaking } : p)
        );
      });

      // Listen for room title changes
      socket.on('roomTitleChanged', ({ title }) => {
        setRoomTitle(title);
      });

      // Listen for user kicked
      socket.on('kicked', () => {
        cleanup();
        setError('You have been removed from the room');
      });

      // Listen for force mute
      socket.on('forceMuted', () => {
        localStreamRef.current?.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
        setIsMuted(true);
      });

      // Listen for co-host updates
      socket.on('coHostAdded', ({ peerId }) => {
        setCoHosts(prev => [...prev, peerId]);
      });

      socket.on('coHostRemoved', ({ peerId }) => {
        setCoHosts(prev => prev.filter(id => id !== peerId));
      });

      // Listen for disconnect and handle auto-reconnect
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);

        // Only auto-reconnect if it wasn't intentional
        if (shouldReconnectRef.current && reason !== 'io client disconnect') {
          setIsReconnecting(true);
          const attempt = reconnectAttempts + 1;
          setReconnectAttempts(attempt);

          if (attempt <= maxReconnectAttempts) {
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
            console.log(`Reconnecting in ${delay}ms (attempt ${attempt}/${maxReconnectAttempts})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              cleanup(false);
              join();
            }, delay);
          } else {
            setIsReconnecting(false);
            setError('Connection lost. Please rejoin the room.');
          }
        }
      });

      // Mark that we should reconnect on unexpected disconnect
      shouldReconnectRef.current = true;

      // Set up speaking detection
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
        const speaking = average > 20; // Threshold for detecting speech

        if (speaking !== wasSpeaking) {
          wasSpeaking = speaking;
          setIsSpeaking(speaking);
          socketRef.current?.emit('speakingChanged', { isSpeaking: speaking });
        }
      }, 100);

      // Add existing peers
      joinResponse.peers?.forEach((peer: any) => {
        setParticipants(prev => {
          if (prev.find(p => p.peerId === peer.id)) return prev;
          return [...prev, { peerId: peer.id, isMuted: false, isSpeaking: false, hasRaisedHand: false }];
        });
      });

      setIsConnected(true);
      setIsMuted(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);
    } catch (err: any) {
      console.error('Join error:', err);
      setError(err.message || 'Failed to join voice room');
      cleanup();
    } finally {
      setIsConnecting(false);
    }
  }, [walletAddress, marketAddress, isConnected, isConnecting, cleanup, consumeProducer, VOICE_SERVER_URL]);

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
    // Also show locally
    const reactionId = `${walletAddress}-${Date.now()}-${Math.random()}`;
    setReactions(prev => [...prev, { id: reactionId, emoji, peerId: walletAddress }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== reactionId));
    }, 3000);
  }, [walletAddress]);

  // Host controls
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
  }, [isHost]);

  // Co-host controls (founder only)
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    participants,
    isMuted,
    isSpeaking,
    hasRaisedHand,
    reactions,
    roomTitle,
    isHost,
    isFounder,
    isCoHost,
    coHosts,
    error,
    join,
    leave,
    toggleMute,
    toggleHand,
    sendReaction,
    // Host controls
    kickUser,
    muteUser,
    updateRoomTitle,
    approveHand,
    // Founder-only controls
    addCoHost,
    removeCoHost,
  };
}
