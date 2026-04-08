/**
 * Unified wallet hook for Privy integration
 * Provides a consistent interface for wallet operations across the app
 */

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMemo } from 'react';

export interface WalletHookReturn {
  // User and authentication
  user: any | null;
  authenticated: boolean;
  ready: boolean;
  loading: boolean;

  // Wallet data
  primaryWallet: {
    address: string;
    chainType: string;
  } | null;
  wallets: any[];

  // Actions
  login: () => void;
  logout: () => Promise<void>;

  // Compatibility with existing code
  setShowAuthFlow?: (show: boolean) => void;
}

/**
 * Main wallet hook that wraps Privy functionality
 * Drop-in replacement for useDynamicContext
 */
export function useWallet(): WalletHookReturn {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // Helper function to check if address is Solana format (base58, not 0x...)
  const isSolanaAddress = (address: string): boolean => {
    if (!address) return false;
    // Ethereum addresses start with 0x, Solana addresses are base58 (32-44 chars, no 0x)
    if (address.startsWith('0x')) return false;
    // Solana addresses are typically 32-44 characters in base58
    return address.length >= 32 && address.length <= 44;
  };

  // Find Solana wallet (external or embedded)
  const primaryWallet = useMemo(() => {
    // Priority 1: Check linkedAccounts for embedded Solana wallet (most reliable for social login)
    if (user?.linkedAccounts) {
      const embeddedWallet = user.linkedAccounts.find(
        (account: any) =>
          account.type === 'wallet' &&
          account.chainType === 'solana' &&
          account.address &&
          isSolanaAddress(account.address)
      );
      if (embeddedWallet) {
        return {
          address: embeddedWallet.address,
          chainType: 'solana',
          isAuthenticated: authenticated,
          isEmbedded: embeddedWallet.walletClientType === 'privy',
          connector: {
            name: embeddedWallet.walletClientType === 'privy' ? 'Embedded Wallet' : 'Linked Wallet',
            shortName: embeddedWallet.walletClientType === 'privy' ? 'EMB' : 'LNK',
          },
          _privyWallet: embeddedWallet,
        };
      }
    }

    // Priority 2: Check for Privy embedded wallet from user.wallet (fallback)
    if (user?.wallet && user.wallet.chainType === 'solana' && isSolanaAddress(user.wallet.address)) {
      return {
        address: user.wallet.address,
        chainType: 'solana',
        isAuthenticated: authenticated,
        isEmbedded: true,
        connector: {
          name: 'Embedded Wallet',
          shortName: 'EMB',
        },
        _privyWallet: user.wallet,
      };
    }

    // Priority 3: Check wallets from useWallets() for external wallets
    if (!wallets || wallets.length === 0) return null;

    // Filter out non-Solana wallets (MetaMask, Ethereum, etc.)
    const solanaWallets = wallets.filter((w: any) => {
      // Exclude known EVM wallets
      const evmWallets = ['metamask', 'coinbase_wallet', 'walletconnect', 'rainbow'];
      if (evmWallets.includes(w.walletClientType?.toLowerCase())) {
        return false;
      }

      // Exclude wallets with Ethereum addresses
      if (w.address && !isSolanaAddress(w.address)) {
        return false;
      }

      return true;
    });

    // Look for external Solana wallets (Phantom, Solflare, etc.)
    let targetWallet = solanaWallets.find((w: any) =>
      w.walletClientType === 'solana' && isSolanaAddress(w.address)
    );

    if (!targetWallet) {
      targetWallet = solanaWallets.find((w: any) =>
        w.address && isSolanaAddress(w.address)
      );
    }

    if (!targetWallet) {
      console.warn('No Solana-compatible wallet found. Please connect a Solana wallet.');
      return null;
    }

    // Determine if this is an embedded or external wallet
    const isEmbedded = targetWallet.walletClientType === 'privy';

    return {
      address: targetWallet.address || '',
      chainType: 'solana', // Always treat as Solana
      isAuthenticated: authenticated,
      isEmbedded,
      connector: {
        name: isEmbedded ? 'Embedded Wallet' : 'Solana Wallet',
        shortName: isEmbedded ? 'EMB' : 'SOL',
      },
      // Pass through the full wallet object for advanced operations
      _privyWallet: targetWallet,
    };
  }, [wallets, authenticated, user]);

  // Compatibility wrapper for setShowAuthFlow
  const setShowAuthFlow = (show: boolean) => {
    if (show && !authenticated) {
      login();
    }
  };

  return {
    user,
    authenticated,
    ready,
    loading: !ready,
    primaryWallet,
    wallets,
    login,
    logout,
    setShowAuthFlow,
  };
}

/**
 * Hook for getting wallet address
 * Simplified version for components that only need the address
 */
export function useWalletAddress(): string | null {
  const { primaryWallet } = useWallet();
  return primaryWallet?.address || null;
}

/**
 * Hook for checking if user is connected
 */
export function useIsConnected(): boolean {
  const { authenticated, ready } = useWallet();
  return ready && authenticated;
}
