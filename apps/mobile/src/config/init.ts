/**
 * Initialize @pnl/shared for the mobile app.
 * Must be imported before anything else.
 */

import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Polyfills
global.Buffer = global.Buffer || Buffer;

import { setEnvConfig } from '@pnl/shared/config';

// In production, these would come from app.json extra or expo-constants
// For now, configure for the deployed web backend
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://pnl.market'; // Update with actual production URL

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
  PRIVY_APP_ID: '', // Set via app config
});
