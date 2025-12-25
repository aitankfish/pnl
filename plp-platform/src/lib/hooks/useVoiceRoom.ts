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
}

interface UseVoiceRoomProps {
  marketAddress: string;
  walletAddress?: string | null;
}

export function useVoiceRoom({ marketAddress, walletAddress }: UseVoiceRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producerRef = useRef<Producer | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'http://localhost:3002';

  const cleanup = useCallback(() => {
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
    setParticipants([]);
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
        return [...prev, { peerId, isMuted: false, isSpeaking: false }];
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

      // Add existing peers
      joinResponse.peers?.forEach((peer: any) => {
        setParticipants(prev => {
          if (prev.find(p => p.peerId === peer.id)) return prev;
          return [...prev, { peerId: peer.id, isMuted: false, isSpeaking: false }];
        });
      });

      setIsConnected(true);
      setIsMuted(true);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnected,
    isConnecting,
    participants,
    isMuted,
    error,
    join,
    leave,
    toggleMute,
  };
}
