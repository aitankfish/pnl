/**
 * VoiceRoomProvider — React Native port of web VoiceRoomContext.tsx
 *
 * Key differences from web:
 * - Uses react-native-webrtc for getUserMedia (registered via index.js)
 * - No Audio() elements — RN WebRTC auto-plays consumed audio tracks
 * - No AudioContext/AnalyserNode — relies on server `speakingChanged` events
 * - Uses expo-router for navigation instead of window.location
 * - Uses VOICE_SERVER_URL from config instead of process.env
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import type { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';
// Lazy-load react-native-webrtc to avoid crash in Expo Go
let mediaDevices: any;
try { mediaDevices = require('react-native-webrtc').mediaDevices; } catch (_e) { mediaDevices = null; }
import { router } from 'expo-router';
import { apiUrl, getSocketUrl } from '@pnl/shared/utils';
import { VOICE_SERVER_URL } from '../config/init';
import { useLiveActivity } from '../hooks/useLiveActivity';

export interface VoiceParticipant {
  peerId: string;
  displayName?: string;
  profilePhotoUrl?: string;
  isMuted: boolean;
  isSpeaking: boolean;
  hasRaisedHand: boolean;
  isSpeaker: boolean;
}

export const MAX_SPEAKERS = 8;

export interface Reaction {
  id: string;
  emoji: string;
  peerId: string;
}

export const REACTION_EMOJIS = ['👏', '🔥', '💯', '❤️', '😂', '🚀'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

interface VoiceRoomState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  marketId: string | null;
  marketAddress: string | null;
  marketName: string | null;
  walletAddress: string | null;
  founderWallet: string | null;
  roomTitle: string;
  participants: VoiceParticipant[];
  coHosts: string[];
  tempHostId: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  hasRaisedHand: boolean;
  isSpeaker: boolean;
  speakerCount: number;
  canJoinAsSpeaker: boolean;
  reactions: Reaction[];
  error: string | null;
  isMinimized: boolean;
  showJoinChoice: boolean;
  isSwitchingRoom: boolean;
  isHost: boolean;
  isFounder: boolean;
  isCoHost: boolean;
  isTempHost: boolean;
}

interface VoiceRoomContextType extends VoiceRoomState {
  join: (marketId: string, marketAddress: string, marketName: string, walletAddress: string, founderWallet: string | null) => Promise<void>;
  switchRoom: (newMarketId: string, newMarketAddress: string, newMarketName: string, newFounderWallet: string | null) => Promise<void>;
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
  if (!context) throw new Error('useVoiceRoomContext must be used within VoiceRoomProvider');
  return context;
}

export function useVoiceRoomContextSafe() {
  return useContext(VoiceRoomContext);
}

export function VoiceRoomProvider({ children }: { children: ReactNode }) {
  const { startActivity, updateActivity, endActivity } = useLiveActivity();

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Room info
  const [marketId, setMarketId] = useState<string | null>(null);
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
  const [isSwitchingRoom, setIsSwitchingRoom] = useState(false);

  // Pending join data
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
  const localStreamRef = useRef<any>(null); // RN MediaStream
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(false);
  const reactionTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const mainSocketRef = useRef<Socket | null>(null);
  const isMountedRef = useRef(true);
  const maxReconnectAttempts = 5;

  // Lazy-connect to main socket for voice activity broadcasts
  const getMainSocket = useCallback(() => {
    if (mainSocketRef.current?.connected) return mainSocketRef.current;
    if (mainSocketRef.current) mainSocketRef.current.disconnect();
    const s = io(getSocketUrl(), { path: '/api/socket/io', transports: ['websocket', 'polling'] });
    mainSocketRef.current = s;
    return s;
  }, []);

  // Computed
  const isFounder = walletAddress === founderWallet;
  const isCoHost = walletAddress ? coHosts.includes(walletAddress) : false;
  const isTempHost = walletAddress === tempHostId && !isFounder;
  const isHost = isFounder || isCoHost || isTempHost;
  const canJoinAsSpeaker = speakerCount < MAX_SPEAKERS;

  const cleanup = useCallback((intentional = true) => {
    if (intentional) shouldReconnectRef.current = false;

    // End Live Activity on Dynamic Island
    endActivity();

    // Notify main socket about leaving voice room
    if (marketAddress && mainSocketRef.current?.connected) {
      try { mainSocketRef.current.emit('voice:left', { marketAddress }); } catch {}
    }

    reactionTimeoutsRef.current.forEach((t) => clearTimeout(t));
    reactionTimeoutsRef.current.clear();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Stop local audio tracks
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track: any) => track.stop());
      } catch {}
      localStreamRef.current = null;
    }

    producerRef.current?.close();
    producerRef.current = null;

    consumersRef.current.forEach((consumer) => consumer.close());
    consumersRef.current.clear();

    // No audio elements to clean up — RN WebRTC auto-plays consumed tracks

    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;

    socketRef.current?.disconnect();
    socketRef.current = null;
    deviceRef.current = null;

    if (isMountedRef.current) {
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
    }
  }, [endActivity]);

  const consumeProducer = useCallback(async (producerId: string, peerId: string) => {
    if (!socketRef.current || !deviceRef.current || !recvTransportRef.current) return;

    socketRef.current.emit(
      'consume',
      { producerId, rtpCapabilities: deviceRef.current.rtpCapabilities },
      async (response: any) => {
        if (response.error) return;

        const consumer = await recvTransportRef.current!.consume({
          id: response.id,
          producerId: response.producerId,
          kind: response.kind,
          rtpParameters: response.rtpParameters,
        });

        consumersRef.current.set(producerId, consumer);

        // RN WebRTC auto-plays audio — no HTMLAudioElement needed
        // The consumer's track is automatically rendered

        setParticipants((prev) => {
          if (prev.find((p) => p.peerId === peerId)) return prev;
          return [...prev, { peerId, isMuted: false, isSpeaking: false, hasRaisedHand: false, isSpeaker: true }];
        });
      },
    );
  }, []);

  // Internal join function
  const doJoin = useCallback(
    async (joinAsSpeaker: boolean) => {
      const pending = pendingJoinRef.current;
      if (!pending || isConnected || isConnecting) {
        console.log('[Voice] doJoin early return:', { pending: !!pending, isConnected, isConnecting });
        return;
      }
      console.log('[Voice] doJoin starting, joinAsSpeaker:', joinAsSpeaker);

      const { marketAddress: addr, marketName: name, walletAddress: wallet, founderWallet: founder } = pending;

      setMarketAddress(addr);
      setMarketName(name);
      setWalletAddress(wallet);
      setFounderWallet(founder);
      setIsConnecting(true);
      setShowJoinChoice(false);
      setError(null);

      const willBeSpeaker = wallet === founder || joinAsSpeaker;
      setIsSpeaker(willBeSpeaker);

      try {
        // Get mic stream via react-native-webrtc
        console.log('[Voice] mediaDevices available:', !!mediaDevices);
        if (!mediaDevices) {
          throw new Error(
            'react-native-webrtc is not available. Voice rooms require a development build (not Expo Go).',
          );
        }
        console.log('[Voice] Requesting mic permission...');
        const stream = await mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          },
        });
        localStreamRef.current = stream;
        (stream as any).getAudioTracks().forEach((track: any) => {
          track.enabled = false;
        });

        // Connect to voice server (use websocket + polling fallback like main socket)
        console.log('[Voice] Got mic stream, connecting to voice server:', VOICE_SERVER_URL);
        const socket = io(VOICE_SERVER_URL, {
          transports: ['websocket', 'polling'],
          reconnection: false, // We handle reconnection manually
        });
        socketRef.current = socket;

        await new Promise<void>((resolve, reject) => {
          socket.on('connect', () => resolve());
          socket.on('connect_error', (err) =>
            reject(new Error(`Voice server unreachable: ${err.message}`)),
          );
          setTimeout(
            () => reject(new Error('Voice server connection timed out. Is the voice server running?')),
            10000,
          );
        });

        // Join room
        const joinResponse = await new Promise<any>((resolve, reject) => {
          socket.emit('joinRoom', { roomId: addr, peerId: wallet }, (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response);
          });
        });

        // Load mediasoup device — must specify ReactNative handler since
        // detectDevice() can't auto-detect from navigator.userAgent in RN
        const device = new Device({ handlerName: 'ReactNative106' });
        await device.load({ routerRtpCapabilities: joinResponse.rtpCapabilities });
        deviceRef.current = device;

        // Create send transport
        const sendTransport = device.createSendTransport(joinResponse.sendTransportOptions);
        sendTransportRef.current = sendTransport;

        sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connectTransport', { transportId: sendTransport.id, dtlsParameters }, (res: any) => {
            if (res.error) errback(new Error(res.error));
            else callback();
          });
        });

        sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
          socket.emit('produce', { kind, rtpParameters }, (res: any) => {
            if (res.error) errback(new Error(res.error));
            else callback({ id: res.id });
          });
        });

        // Create recv transport
        const recvTransport = device.createRecvTransport(joinResponse.recvTransportOptions);
        recvTransportRef.current = recvTransport;

        recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connectTransport', { transportId: recvTransport.id, dtlsParameters }, (res: any) => {
            if (res.error) errback(new Error(res.error));
            else callback();
          });
        });

        // Produce audio
        const track = (stream as any).getAudioTracks()[0];
        const producer = await sendTransport.produce({
          track,
          codecOptions: {
            opusStereo: false,
            opusDtx: true,
            opusFec: true,
            opusMaxPlaybackRate: 48000,
          },
          encodings: [{ maxBitrate: 64000 }],
        });
        producerRef.current = producer;

        // Consume existing producers
        socket.emit('getProducers', (response: any) => {
          response.producers?.forEach((p: any) => consumeProducer(p.producerId, p.peerId));
        });

        // Socket event listeners
        socket.on('newProducer', ({ producerId, peerId }) => consumeProducer(producerId, peerId));

        socket.on('peerLeft', ({ peerId }) => {
          setParticipants((prev) => prev.filter((p) => p.peerId !== peerId));
        });

        socket.on('handRaised', ({ peerId }) => {
          setParticipants((prev) => prev.map((p) => (p.peerId === peerId ? { ...p, hasRaisedHand: true } : p)));
        });

        socket.on('handLowered', ({ peerId }) => {
          setParticipants((prev) => prev.map((p) => (p.peerId === peerId ? { ...p, hasRaisedHand: false } : p)));
        });

        socket.on('reaction', ({ peerId, emoji }) => {
          const reactionId = `${peerId}-${Date.now()}-${Math.random()}`;
          setReactions((prev) => [...prev, { id: reactionId, emoji, peerId }]);
          const t = setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reactionId));
            reactionTimeoutsRef.current.delete(t);
          }, 3000);
          reactionTimeoutsRef.current.add(t);
        });

        // Speaking detection from server (no Web Audio API on RN)
        socket.on('speakingChanged', ({ peerId, isSpeaking: speaking }) => {
          if (peerId === wallet) {
            setIsSpeaking(speaking);
          }
          setParticipants((prev) => prev.map((p) => (p.peerId === peerId ? { ...p, isSpeaking: speaking } : p)));
        });

        socket.on('roomTitleChanged', ({ title }) => setRoomTitle(title));

        socket.on('kicked', () => {
          cleanup();
          setError('You have been removed from the room');
        });

        socket.on('forceMuted', () => {
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t: any) => {
              t.enabled = false;
            });
          }
          setIsMuted(true);
        });

        socket.on('coHostAdded', ({ peerId }) => setCoHosts((prev) => [...prev, peerId]));
        socket.on('coHostRemoved', ({ peerId }) => setCoHosts((prev) => prev.filter((id) => id !== peerId)));

        socket.on('promotedToSpeaker', ({ peerId }) => {
          if (peerId === wallet) {
            setIsSpeaker(true);
            setHasRaisedHand(false);
          }
          setParticipants((prev) =>
            prev.map((p) => (p.peerId === peerId ? { ...p, isSpeaker: true, hasRaisedHand: false } : p)),
          );
          setSpeakerCount((prev) => prev + 1);
        });

        socket.on('demotedToListener', ({ peerId }) => {
          if (peerId === wallet) setIsSpeaker(false);
          setParticipants((prev) => prev.map((p) => (p.peerId === peerId ? { ...p, isSpeaker: false } : p)));
          setSpeakerCount((prev) => Math.max(0, prev - 1));
        });

        socket.on('tempHostChanged', ({ peerId }) => setTempHostId(peerId));

        socket.on('disconnect', (reason) => {
          if (!isMountedRef.current) return;
          setIsConnected(false);

          if (shouldReconnectRef.current && reason !== 'io client disconnect') {
            setIsReconnecting(true);
            const attempt = reconnectAttempts + 1;
            setReconnectAttempts(attempt);

            if (attempt <= maxReconnectAttempts) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
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

        // Process existing peers
        let currentSpeakerCount = 0;
        joinResponse.peers?.forEach((peer: any) => {
          const peerIsSpeaker = peer.isSpeaker !== false;
          if (peerIsSpeaker) currentSpeakerCount++;
          setParticipants((prev) => {
            if (prev.find((p) => p.peerId === peer.id)) return prev;
            return [...prev, { peerId: peer.id, isMuted: false, isSpeaking: false, hasRaisedHand: false, isSpeaker: peerIsSpeaker }];
          });
        });

        if (willBeSpeaker && currentSpeakerCount === 0 && wallet !== founder) {
          setTempHostId(wallet);
        }

        setSpeakerCount(currentSpeakerCount + (willBeSpeaker ? 1 : 0));
        setIsConnected(true);
        setIsMuted(true);
        setIsReconnecting(false);
        setReconnectAttempts(0);

        // Start Live Activity on Dynamic Island
        const symbol = name.replace(/\s+/g, '').substring(0, 6).toUpperCase();
        startActivity(pendingJoinRef.current?.marketAddress || addr, name, symbol);

        // Notify main socket about voice activity
        try { getMainSocket().emit('voice:joined', { marketAddress: addr }); } catch {}

        // Founder joined notification
        if (wallet === founder) {
          fetch(apiUrl('/api/voice/founder-joined'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marketAddress: addr, marketName: name, founderWallet: founder, walletAddress: wallet }),
          }).catch(() => {});
        }
      } catch (err: any) {
        console.error('[Voice] doJoin failed:', err.message);
        // IMPORTANT: cleanup() must run BEFORE setError() because cleanup(true)
        // calls setError(null). React batches both updates — the last setError wins.
        cleanup();
        const errorMsg = err.message || 'Failed to join voice room';
        setError(errorMsg);
        Alert.alert('Voice Room Error', errorMsg);
      } finally {
        setIsConnecting(false);
        pendingJoinRef.current = null;
      }
    },
    [isConnected, isConnecting, cleanup, consumeProducer, reconnectAttempts, marketId, marketAddress, walletAddress, marketName, founderWallet, startActivity],
  );

  // Fast room switch — keeps socket, device, and mic alive
  const switchRoom = useCallback(
    async (newMarketId: string, newMarketAddress: string, newMarketName: string, newFounderWallet: string | null) => {
      const socket = socketRef.current;
      const device = deviceRef.current;
      const wallet = walletAddress;

      if (!socket || !device || !wallet || !isConnected || isSwitchingRoom) return;
      if (!marketAddress || marketAddress === newMarketAddress) return;

      const fromRoom = marketAddress;
      console.log(`[Voice] switchRoom: ${fromRoom} -> ${newMarketAddress}`);
      setIsSwitchingRoom(true);

      try {
        // 1. Close old consumers (safe, doesn't affect mic)
        consumersRef.current.forEach((consumer) => consumer.close());
        consumersRef.current.clear();

        // 2. Detach old producer/transports without closing them
        //    (closing kills the underlying mic track on RN)
        producerRef.current = null;
        sendTransportRef.current = null;
        recvTransportRef.current = null;

        // 3. Ensure we have a live mic track (re-acquire if ended)
        let audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (!audioTrack || (audioTrack as any).readyState === 'ended') {
          console.log('[Voice] Mic track ended, re-acquiring...');
          const stream = await mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 },
          });
          localStreamRef.current = stream;
          (stream as any).getAudioTracks().forEach((t: any) => { t.enabled = false; });
          audioTrack = (stream as any).getAudioTracks()[0];
        }

        // 4. Clear old room state
        setParticipants([]);
        setCoHosts([]);
        setRoomTitle('');
        setHasRaisedHand(false);
        setTempHostId(null);
        setReactions([]);
        reactionTimeoutsRef.current.forEach((t) => clearTimeout(t));
        reactionTimeoutsRef.current.clear();

        // 3. Emit switchRoom to server (socket stays alive)
        const response = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('switchRoom timed out')), 10000);
          socket.emit('switchRoom', { fromRoom, toRoom: newMarketAddress, peerId: wallet }, (res: any) => {
            clearTimeout(timeout);
            if (res.error) reject(new Error(res.error));
            else resolve(res);
          });
        });

        // 4. Create new transports on new room's Router
        const sendTransport = device.createSendTransport(response.sendTransportOptions);
        sendTransportRef.current = sendTransport;

        sendTransport.on('connect', ({ dtlsParameters }: any, callback: any, errback: any) => {
          socket.emit('connectTransport', { transportId: sendTransport.id, dtlsParameters }, (res: any) => {
            if (res.error) errback(new Error(res.error));
            else callback();
          });
        });

        sendTransport.on('produce', ({ kind, rtpParameters }: any, callback: any, errback: any) => {
          socket.emit('produce', { kind, rtpParameters }, (res: any) => {
            if (res.error) errback(new Error(res.error));
            else callback({ id: res.id });
          });
        });

        const recvTransport = device.createRecvTransport(response.recvTransportOptions);
        recvTransportRef.current = recvTransport;

        recvTransport.on('connect', ({ dtlsParameters }: any, callback: any, errback: any) => {
          socket.emit('connectTransport', { transportId: recvTransport.id, dtlsParameters }, (res: any) => {
            if (res.error) errback(new Error(res.error));
            else callback();
          });
        });

        // 5. Produce audio (reuse mic track from step 3)
        const producer = await sendTransport.produce({
          track: audioTrack,
          codecOptions: { opusStereo: false, opusDtx: true, opusFec: true, opusMaxPlaybackRate: 48000 },
          encodings: [{ maxBitrate: 64000 }],
        });
        producerRef.current = producer;

        // 6. Consume existing producers in new room
        socket.emit('getProducers', (res: any) => {
          res.producers?.forEach((p: any) => consumeProducer(p.producerId, p.peerId));
        });

        // 7. Process peers
        let currentSpeakerCount = 0;
        response.peers?.forEach((peer: any) => {
          const peerIsSpeaker = peer.isSpeaker !== false;
          if (peerIsSpeaker) currentSpeakerCount++;
          setParticipants((prev) => {
            if (prev.find((p) => p.peerId === peer.id)) return prev;
            return [...prev, { peerId: peer.id, isMuted: false, isSpeaking: false, hasRaisedHand: false, isSpeaker: peerIsSpeaker }];
          });
        });

        const isNewFounder = wallet === newFounderWallet;
        if (currentSpeakerCount === 0 && !isNewFounder) {
          setTempHostId(wallet);
        }

        // 8. Update state
        setMarketId(newMarketId);
        setMarketAddress(newMarketAddress);
        setMarketName(newMarketName);
        setFounderWallet(newFounderWallet);
        setIsSpeaker(true);
        setSpeakerCount(currentSpeakerCount + 1);
        setIsMuted(true);
        setHasRaisedHand(false);

        // Mute mic track after switch
        localStreamRef.current?.getAudioTracks().forEach((t: any) => { t.enabled = false; });

        // 9. Notify main socket
        try { getMainSocket().emit('voice:left', { marketAddress: fromRoom }); } catch {}
        try { getMainSocket().emit('voice:joined', { marketAddress: newMarketAddress }); } catch {}

        // 10. Update Live Activity
        const symbol = newMarketName.replace(/\s+/g, '').substring(0, 6).toUpperCase();
        startActivity(newMarketAddress, newMarketName, symbol);

        // Founder notification
        if (isNewFounder) {
          fetch(apiUrl('/api/voice/founder-joined'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marketAddress: newMarketAddress, marketName: newMarketName, founderWallet: newFounderWallet, walletAddress: wallet }),
          }).catch(() => {});
        }

        console.log(`[Voice] switchRoom complete: now in ${newMarketAddress}`);
      } catch (err: any) {
        console.error('[Voice] switchRoom failed, falling back to full rejoin:', err.message);
        // Full cleanup and let user rejoin manually
        cleanup();
        setError(err.message || 'Failed to switch rooms');
      } finally {
        setIsSwitchingRoom(false);
      }
    },
    [isConnected, isSwitchingRoom, marketAddress, walletAddress, cleanup, consumeProducer, getMainSocket, startActivity],
  );

  // Public join
  const join = useCallback(
    async (newMarketId: string, newMarketAddress: string, newMarketName: string, newWalletAddress: string, newFounderWallet: string | null) => {
      console.log('[Voice] join() called:', { newMarketId, wallet: newWalletAddress, isFounder: newWalletAddress === newFounderWallet });
      if (isConnecting) {
        console.log('[Voice] join() early return: already connecting');
        return;
      }

      // Already in a voice room — fast switch
      if (isConnected && marketId && marketId !== newMarketId) {
        switchRoom(newMarketId, newMarketAddress, newMarketName, newFounderWallet);
        return;
      }

      // Already in this room
      if (isConnected && marketId === newMarketId) return;

      setMarketId(newMarketId);
      pendingJoinRef.current = {
        marketAddress: newMarketAddress,
        marketName: newMarketName,
        walletAddress: newWalletAddress,
        founderWallet: newFounderWallet,
      };

      // Founder auto-joins as speaker
      if (newWalletAddress === newFounderWallet) {
        doJoin(true);
        return;
      }

      setShowJoinChoice(true);
    },
    [isConnected, isConnecting, marketId, doJoin, switchRoom],
  );

  const joinAsSpeaker = useCallback(() => doJoin(true), [doJoin]);
  const joinAsListener = useCallback(() => doJoin(false), [doJoin]);
  const cancelJoinChoice = useCallback(() => {
    setShowJoinChoice(false);
    pendingJoinRef.current = null;
  }, []);

  const leave = useCallback(() => cleanup(), [cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((t: any) => {
      t.enabled = !newMuted;
    });
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleHand = useCallback(() => {
    if (!socketRef.current) return;
    if (hasRaisedHand) {
      socketRef.current.emit('lowerHand');
      setHasRaisedHand(false);
    } else {
      socketRef.current.emit('raiseHand');
      setHasRaisedHand(true);
    }
  }, [hasRaisedHand]);

  const sendReaction = useCallback(
    (emoji: ReactionEmoji) => {
      if (!socketRef.current || !walletAddress) return;
      socketRef.current.emit('reaction', { emoji });
      const reactionId = `${walletAddress}-${Date.now()}-${Math.random()}`;
      setReactions((prev) => [...prev, { id: reactionId, emoji, peerId: walletAddress }]);
      const t = setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reactionId));
        reactionTimeoutsRef.current.delete(t);
      }, 3000);
      reactionTimeoutsRef.current.add(t);
    },
    [walletAddress],
  );

  const kickUser = useCallback(
    (peerId: string) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit('kickUser', { peerId });
    },
    [isHost],
  );

  const muteUser = useCallback(
    (peerId: string) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit('muteUser', { peerId });
    },
    [isHost],
  );

  const muteAll = useCallback(() => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('muteAll');
  }, [isHost]);

  const updateRoomTitle = useCallback(
    (title: string) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit('setRoomTitle', { title });
      setRoomTitle(title);
    },
    [isHost],
  );

  const approveHand = useCallback(
    (peerId: string) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit('approveHand', { peerId });
      setParticipants((prev) => prev.map((p) => (p.peerId === peerId ? { ...p, hasRaisedHand: false, isSpeaker: true } : p)));
      setSpeakerCount((prev) => prev + 1);
    },
    [isHost],
  );

  const promoteToSpeaker = useCallback(
    (peerId: string) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit('promoteToSpeaker', { peerId });
      setParticipants((prev) => prev.map((p) => (p.peerId === peerId ? { ...p, isSpeaker: true, hasRaisedHand: false } : p)));
      setSpeakerCount((prev) => prev + 1);
    },
    [isHost],
  );

  const demoteToListener = useCallback(
    (peerId: string) => {
      if (!socketRef.current || !isHost) return;
      socketRef.current.emit('demoteToListener', { peerId });
      setParticipants((prev) => prev.map((p) => (p.peerId === peerId ? { ...p, isSpeaker: false } : p)));
      setSpeakerCount((prev) => Math.max(0, prev - 1));
    },
    [isHost],
  );

  const addCoHost = useCallback(
    (peerId: string) => {
      if (!socketRef.current || !isFounder) return;
      socketRef.current.emit('addCoHost', { peerId });
      setCoHosts((prev) => [...prev, peerId]);
    },
    [isFounder],
  );

  const removeCoHost = useCallback(
    (peerId: string) => {
      if (!socketRef.current || !isFounder) return;
      socketRef.current.emit('removeCoHost', { peerId });
      setCoHosts((prev) => prev.filter((id) => id !== peerId));
    },
    [isFounder],
  );

  const expandToRoom = useCallback(() => {
    if (marketId) {
      setIsMinimized(false);
      router.push(`/market/${marketId}` as any);
    }
  }, [marketId]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
      mainSocketRef.current?.disconnect();
      mainSocketRef.current = null;
    };
  }, [cleanup]);

  // Update Live Activity when voice room state changes
  useEffect(() => {
    if (!isConnected) return;
    const activeSpeaker = participants.find((p) => p.isSpeaking);
    updateActivity(participants.length, isMuted, activeSpeaker?.displayName);
  }, [isConnected, participants, isMuted, updateActivity]);

  const value: VoiceRoomContextType = {
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
    isSwitchingRoom,
    isHost,
    isFounder,
    isCoHost,
    isTempHost,
    join,
    switchRoom,
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

  return <VoiceRoomContext.Provider value={value}>{children}</VoiceRoomContext.Provider>;
}
