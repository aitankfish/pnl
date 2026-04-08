/**
 * Privy Wallet Provider Setup
 * Configures Privy wallet connection for Solana with custom UI
 */

'use client';

import { memo, useEffect } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import type { PrivyClientConfig } from '@privy-io/react-auth';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { setAccessTokenProvider } from '@pnl/shared/utils';

/** Wires Privy's getAccessToken to the shared authenticated fetch utility */
function AuthWiring({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = usePrivy();
  useEffect(() => {
    setAccessTokenProvider(getAccessToken);
  }, [getAccessToken]);
  return <>{children}</>;
}

interface WalletProviderProps {
  children: React.ReactNode;
}

function WalletProviderInner({ children }: WalletProviderProps) {
  // Get Privy App ID from environment variables
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  if (!appId) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID is not set. Wallet functionality will be limited.');
  }

  const config: PrivyClientConfig = {
    // Appearance customization to match space theme
    appearance: {
      theme: 'dark',
      accentColor: '#3b82f6',
      logo: '/logo.png',
      landingHeader: 'Sign in to P&L',
      loginMessage: 'Create an account or sign in to access your wallet and start trading.',
      showWalletLoginFirst: false, // Show email/socials first
      walletList: ['phantom', 'backpack', 'solflare', 'detected_solana_wallets'], // Specific wallets first, then detected
      walletChainType: 'solana-only', // Only show Solana wallets
    },

    // Login methods configuration - email and socials first
    loginMethods: ['email', 'google', 'twitter', 'wallet'],

    // Embedded wallet configuration - Solana embedded wallets
    embeddedWallets: {
      solana: {
        createOnLogin: 'all-users', // Changed from 'users-without-wallets' to always load/create wallets
      },
      showWalletUIs: false, // No prompt on signature (replaces noPromptOnSignature)
    },

    // Solana network configuration - Required for embedded wallet UIs
    solana: {
      rpcs: {
        'solana:mainnet': {
          rpc: createSolanaRpc(process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'),
          rpcSubscriptions: createSolanaRpcSubscriptions(process.env.NEXT_PUBLIC_HELIUS_WS_MAINNET || 'wss://api.mainnet-beta.solana.com'),
        },
        'solana:devnet': {
          rpc: createSolanaRpc(process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com'),
          rpcSubscriptions: createSolanaRpcSubscriptions(process.env.NEXT_PUBLIC_HELIUS_WS_DEVNET || 'wss://api.devnet.solana.com'),
        },
      },
    },

    // Legal and privacy
    legal: {
      termsAndConditionsUrl: 'https://pnl.market/terms',
      privacyPolicyUrl: 'https://pnl.market/privacy',
    },
  };

  return (
    <PrivyProvider appId={appId} config={config}>
      <AuthWiring>{children}</AuthWiring>
    </PrivyProvider>
  );
}

// Memoize the provider to prevent unnecessary re-renders
export const WalletProvider = memo(WalletProviderInner);
