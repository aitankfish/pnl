/**
 * Initialize @pnl/shared for the mobile app.
 * Must be imported before anything else.
 */

// Polyfills are now in index.js (app entry point) so they run before any route imports

import { setEnvConfig } from '@pnl/shared/config';
import { setNetwork as setSolanaNetwork } from '@pnl/shared/solana';

// Privy App ID (same as web's NEXT_PUBLIC_PRIVY_APP_ID)
export const PRIVY_APP_ID = 'cmgn1ettr01tal10dchxxjx2w';

// Privy Client ID (required by @privy-io/expo for auth flows)
// Get this from https://dashboard.privy.io/ → your app → Settings → Clients
export const PRIVY_CLIENT_ID = 'client-WY6Rc7yvQxe6GD9R24eu4pyedJ8ofSba5Q7RwaRQJvgfh';

// Detect dev server hostname from Expo (works on physical devices + simulators)
// Constants.expoGoConfig?.debuggerHost gives "192.168.x.x:8081" on device, "localhost:8081" on sim
import Constants from 'expo-constants';

function getDevHost(): string {
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    null;
  if (debuggerHost) {
    // Strip the Expo port (8081) and return just the IP/hostname
    return debuggerHost.split(':')[0];
  }
  return 'localhost';
}

const API_BASE_URL = __DEV__
  ? `http://${getDevHost()}:3000`
  : 'https://pnl.market';

// DEV OVERRIDE: Use production API when local server isn't running.
// Comment this out when running pnpm dev:unified locally.
const USE_PROD_API = true;
const RESOLVED_API_BASE_URL = __DEV__ && USE_PROD_API ? 'https://pnl.market' : API_BASE_URL;

// Voice server URL (separate from the main API)
// Always use production voice server — there is no local voice server in dev.
// Matches web's NEXT_PUBLIC_VOICE_SERVER_URL env var.
export const VOICE_SERVER_URL = 'https://voice.pnl.market';

setEnvConfig({
  SOLANA_NETWORK: 'mainnet-beta',
  PLP_PROGRAM_ID_DEVNET: '2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G',
  PLP_PROGRAM_ID_MAINNET: 'C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86',
  HELIUS_MAINNET_RPC: 'https://mainnet.helius-rpc.com/?api-key=8f773bda-b37a-42ec-989c-b2318c1772d7',
  HELIUS_DEVNET_RPC: 'https://devnet.helius-rpc.com/?api-key=8f773bda-b37a-42ec-989c-b2318c1772d7',
  HELIUS_WS_MAINNET: '',
  API_BASE_URL: RESOLVED_API_BASE_URL,
  APP_URL: 'https://pnl.market',
  PINATA_JWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiZmRhMmI2My0yNTk5LTRjYWEtOTQ3NS04ZjcxYzNiN2FlYzkiLCJlbWFpbCI6InByZWRpY3RsYXVuY2hwdW1wQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJkNjNhNmQ1NmYwYmYwYzA0OThiNiIsInNjb3BlZEtleVNlY3JldCI6IjdmNGI5NTAxYzJkYmE4MDkwOTg3ZTQzMzQ4NWM5ZDM3ZjMzYTMxMTc3OWY1NWYxMzExY2FlY2VjMTU1YzdmYTEiLCJleHAiOjE3OTE3ODkxMjF9.1KaQJUDH6UaO3naoBSFZA73OlRVTxlzBzWqatXvkGSM',
  PINATA_GATEWAY_URL: 'https://sapphire-fantastic-cephalopod-499.mypinata.cloud',
  PRIVY_APP_ID,
});

// Explicitly sync the Solana connection manager — its singleton may have been
// created before setEnvConfig ran (module evaluation race condition).
setSolanaNetwork('mainnet-beta');
