// Entry point — polyfills MUST run before expo-router loads any routes
import 'react-native-webrtc'; // Register WebRTC globals for mediasoup-client
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

// Now load expo-router
import 'expo-router/entry';
