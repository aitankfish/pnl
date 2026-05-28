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

  // Absolute origin for the /api/rpc proxy URL — createSolanaRpc requires an
  // absolute URL. On the client we use the live origin so preview deploys hit
  // their own proxy; during SSR we fall back to the configured app URL.
  const appOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';

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
    // HTTP rpc points at our own /api/rpc proxy (NOT the public Solana RPC,
    // NOT our raw Helius URL). History:
    //   - Raw Helius here let Privy's SDK background-poll Helius's enhanced
    //     "wallettransfers" API, burning ~1M credits/month (commit 8ce2119).
    //   - Switching to the public RPC stopped the burn but broke sends:
    //     api.mainnet-beta.solana.com returns HTTP 403 on sendTransaction
    //     (Solana error 8100002), so voting/claiming failed.
    // The /api/rpc proxy forwards standard JSON-RPC to Helius with the
    // SERVER-SIDE key and rejects the expensive enhanced/DAS methods, so
    // sends are reliable AND the burn cannot recur. See the route for detail.
    //
    // rpcSubscriptions (WS) is only used for tx-confirmation notifications,
    // never for the enhanced polling that caused the burn, so it points
    // straight at Helius WS (falling back to public WS if unset). The key in
    // NEXT_PUBLIC_HELIUS_WS_* is already exposed via other client RPC usage.
    solana: {
      rpcs: {
        'solana:mainnet': {
          rpc: createSolanaRpc(`${appOrigin}/api/rpc?cluster=mainnet`),
          rpcSubscriptions: createSolanaRpcSubscriptions(process.env.NEXT_PUBLIC_HELIUS_WS_MAINNET || 'wss://api.mainnet-beta.solana.com'),
        },
        'solana:devnet': {
          rpc: createSolanaRpc(`${appOrigin}/api/rpc?cluster=devnet`),
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
