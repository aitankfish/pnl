// Entry point — polyfills MUST run before expo-router loads any routes
// Guard WebRTC import — native module not available in Expo Go
// registerGlobals() sets global.RTCPeerConnection etc. needed by mediasoup-client
try {
  const { registerGlobals } = require('react-native-webrtc');
  registerGlobals();
} catch (_e) { /* Expo Go: skip WebRTC registration */ }
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import * as ExpoCrypto from 'expo-crypto';

// Polyfill Buffer
global.Buffer = global.Buffer || Buffer;

// Polyfill global crypto (Web Crypto API) for @privy-io and Solana libs
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: ExpoCrypto.getRandomValues,
    subtle: {},
    randomUUID: ExpoCrypto.randomUUID,
  };
} else if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = ExpoCrypto.getRandomValues;
}

// Polyfill process.env
if (typeof process === 'undefined') {
  global.process = { env: {} };
} else if (!process.env) {
  process.env = {};
}

// Suppress noisy RPC/network warnings from Expo's LogBox (distracting during demos)
import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  'Server responded with',
  'Failed to connect to',
  'max usage reached',
  '429',
  'Retrying after',
  'Helius WebSocket closed',
  '[PNL] Failed to connect',
]);

// Now load expo-router
import 'expo-router/entry';
