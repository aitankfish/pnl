/**
 * Initialize @pnl/shared for the mobile app.
 * Must be imported before anything else.
 *
 * All values come from EXPO_PUBLIC_* env vars (see apps/mobile/.env).
 * Mirrors apps/web/src/lib/shared-init.ts — change .env, restart Expo, done.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { setEnvConfig } from '@pnl/shared/config';
import { setNetwork as setSolanaNetwork } from '@pnl/shared/solana';

// ── Privy IDs (also exported for AuthProvider) ───────────────────────
export const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || '';
export const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || '';

// ── Voice server (also exported for VoiceRoomProvider) ───────────────
export const VOICE_SERVER_URL =
  process.env.EXPO_PUBLIC_VOICE_SERVER_URL || 'https://voice.pnl.market';

// ── Network ──────────────────────────────────────────────────────────
const SOLANA_NETWORK: 'devnet' | 'mainnet-beta' =
  process.env.EXPO_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';

// ── Dev host resolution ──────────────────────────────────────────────
// Simulator can hit localhost directly. For physical-device dev, set
// EXPO_PUBLIC_DEV_HOST in .env to your LAN IP. expoConfig.hostUri is the
// final fallback (Expo populates it when the dev server starts).
function isSimulator(): boolean {
  return Platform.OS === 'ios' && !Constants.isDevice;
}

function getDevHost(): string {
  const override = process.env.EXPO_PUBLIC_DEV_HOST;
  if (override) return override;
  if (isSimulator()) return 'localhost';

  const expoHost =
    Constants.expoGoConfig?.debuggerHost ?? Constants.expoConfig?.hostUri ?? null;
  if (expoHost) {
    const host = expoHost.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }
  return 'localhost';
}

// ── API base URL ─────────────────────────────────────────────────────
// In dev: env var wins, else point at the unified backend on localhost.
// In prod: env var wins, else default to https://pnl.market.
const ENV_API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
const API_BASE_URL = ENV_API_BASE
  ? ENV_API_BASE
  : __DEV__
    ? `http://${getDevHost()}:3000`
    : 'https://pnl.market';

console.log('[PNL Init] network:', SOLANA_NETWORK, '| API:', API_BASE_URL);

setEnvConfig({
  SOLANA_NETWORK,
  PLP_PROGRAM_ID_DEVNET: process.env.EXPO_PUBLIC_PLP_PROGRAM_ID_DEVNET || '',
  PLP_PROGRAM_ID_MAINNET: process.env.EXPO_PUBLIC_PLP_PROGRAM_ID_MAINNET || '',
  HELIUS_DEVNET_RPC:
    process.env.EXPO_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com',
  HELIUS_MAINNET_RPC:
    process.env.EXPO_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com',
  HELIUS_WS_MAINNET: '',
  API_BASE_URL,
  APP_URL: process.env.EXPO_PUBLIC_APP_URL || 'https://pnl.market',
  PINATA_JWT: '', // uploads go through /api/upload/ipfs proxy
  PINATA_GATEWAY_URL:
    process.env.EXPO_PUBLIC_PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud',
  PRIVY_APP_ID,
  PRIVY_CLIENT_ID,
  VOICE_SERVER_URL,
});

// Sync the Solana connection manager — its singleton may have been created
// before setEnvConfig ran (module evaluation race condition).
setSolanaNetwork(SOLANA_NETWORK);
