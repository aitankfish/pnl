/**
 * Privy Wallet Provider Setup
 * Configures Privy wallet connection for Solana with custom UI
 */

'use client';

import { memo, useEffect } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import type { PrivyClientConfig } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
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
      landingHeader: 'Sign in to PNL',
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

    // External wallet connectors — required for Solana wallet login, useWallets, useLoginWithOAuth
    externalWallets: {
      solana: {
        connectors: toSolanaWalletConnectors(),
      },
    },

    // Solana network configuration - Required for embedded wallet UIs.
    //
    // We intentionally use the public Solana RPC here (NOT our Helius RPC).
    // Reason: Privy's SDK polls Helius's enhanced "wallettransfers" API in
    // the background for every connected wallet (~0.3 RPS sustained per
    // session) to power their "Recent Activity" tab and incoming-transfer
    // notifications. With our Helius key, that pollers alone burns ~1M
    // credits/month — and 99% of users never see those features because
    // /wallet renders richer trade history from our own MongoDB anyway.
    //
    // Trade-off: public RPC doesn't expose enhanced APIs, so the calls
    // fail silently and Privy's in-wallet "Activity" tab shows empty.
    // Standard RPC methods (getBalance, sendTransaction, accountSubscribe)
    // work fine on the public endpoint — wallet balance, signing, and
    // submission flows are unaffected.
    //
    // Our own server-side code keeps using HELIUS_API_KEY for the calls
    // that need enhanced features and SLA (tx verification, sync manager).
    solana: {
      rpcs: {
        'solana:mainnet': {
          rpc: createSolanaRpc('https://api.mainnet-beta.solana.com'),
          rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com'),
        },
        'solana:devnet': {
          rpc: createSolanaRpc('https://api.devnet.solana.com'),
          rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.devnet.solana.com'),
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
