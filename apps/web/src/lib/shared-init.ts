/**
 * Initialize @pnl/shared environment config for the web app.
 * Must be called before any shared package code runs.
 */

import { setEnvConfig, isEnvConfigInitialized } from '@pnl/shared/config';

export function initSharedConfig() {
  if (isEnvConfigInitialized()) return;

  setEnvConfig({
    SOLANA_NETWORK: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet',
    PLP_PROGRAM_ID_DEVNET: process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET || '2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G',
    PLP_PROGRAM_ID_MAINNET: process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET || '',
    HELIUS_MAINNET_RPC: process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com',
    HELIUS_DEVNET_RPC: process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com',
    HELIUS_WS_MAINNET: process.env.NEXT_PUBLIC_HELIUS_WS_MAINNET || '',
    API_BASE_URL: '', // Empty for web = relative URLs
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market',
    PINATA_JWT: process.env.PINATA_JWT || '',
    PINATA_GATEWAY_URL: process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud',
    PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
    PRIVY_CLIENT_ID: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || '',
    VOICE_SERVER_URL: process.env.NEXT_PUBLIC_VOICE_SERVER_URL || 'https://voice.pnl.market',
  });
}

// Auto-init on import
initSharedConfig();
