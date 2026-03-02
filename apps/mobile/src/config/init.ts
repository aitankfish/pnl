/**
 * Initialize @pnl/shared for the mobile app.
 * Must be imported before anything else.
 */

// Polyfills are now in index.js (app entry point) so they run before any route imports

import { setEnvConfig } from '@pnl/shared/config';

// Privy App ID (same as web's NEXT_PUBLIC_PRIVY_APP_ID)
export const PRIVY_APP_ID = 'cmgn1ettr01tal10dchxxjx2w';

// Privy Client ID (required by @privy-io/expo for auth flows)
// Get this from https://dashboard.privy.io/ → your app → Settings → Clients
export const PRIVY_CLIENT_ID = 'client-WY6Rc7yvQxe6GD9R24eu4pyedJ8ofSba5Q7RwaRQJvgfh';

// In production, these would come from app.json extra or expo-constants
// For now, configure for the deployed web backend
// Physical device: use Mac's LAN IP. Simulator: localhost works too.
// In production, these would come from app.json extra or expo-constants
// For now, configure for the deployed web backend
// Physical device: use Mac's LAN IP. Simulator: localhost works too.
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://pnl.market'; // Update with actual production URL

// Voice server URL (separate from the main API)
export const VOICE_SERVER_URL = __DEV__
  ? 'http://localhost:3002'
  : 'https://voice.pnl.market';

setEnvConfig({
  SOLANA_NETWORK: 'mainnet-beta',
  PLP_PROGRAM_ID_DEVNET: '2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G',
  PLP_PROGRAM_ID_MAINNET: 'C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86',
  HELIUS_MAINNET_RPC: 'https://api.mainnet-beta.solana.com', // Will be overridden with actual Helius key
  HELIUS_DEVNET_RPC: 'https://api.devnet.solana.com',
  HELIUS_WS_MAINNET: '',
  API_BASE_URL,
  APP_URL: 'https://pnl.market',
  PINATA_JWT: '', // Set via secure config
  PINATA_GATEWAY_URL: 'https://gateway.pinata.cloud',
  PRIVY_APP_ID,
});
