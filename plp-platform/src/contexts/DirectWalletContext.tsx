'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface DirectWalletState {
  isConnected: boolean;
  publicKey: string | null;
  walletType: 'phantom' | 'backpack' | 'solflare' | null;
  isConnecting: boolean;
  error: string | null;
}

interface DirectWalletContextType extends DirectWalletState {
  connect: (walletType: 'phantom' | 'backpack' | 'solflare') => Promise<string | null>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<Uint8Array | null>;
  clearError: () => void;
}

const DirectWalletContext = createContext<DirectWalletContextType | null>(null);

// Storage key for persisting wallet connection
const STORAGE_KEY = 'direct_wallet_connection';

export function DirectWalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DirectWalletState>({
    isConnected: false,
    publicKey: null,
    walletType: null,
    isConnecting: false,
    error: null,
  });

  // Get wallet provider from window
  const getProvider = useCallback((walletType: 'phantom' | 'backpack' | 'solflare') => {
    const win = window as any;

    if (walletType === 'phantom') {
      const provider = win.phantom?.solana || win.solana;
      return provider?.isPhantom ? provider : null;
    }

    if (walletType === 'backpack') {
      return win.backpack || null;
    }

    if (walletType === 'solflare') {
      const provider = win.solflare;
      if (provider?.isSolflare) return provider;
      if (win.solana?.isSolflare) return win.solana;
      return null;
    }

    return null;
  }, []);

  // Restore connection on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { walletType, publicKey } = JSON.parse(stored);
        const provider = getProvider(walletType);

        if (provider && provider.isConnected) {
          // Verify the connection is still valid
          const currentKey = provider.publicKey?.toString();
          if (currentKey === publicKey) {
            setState({
              isConnected: true,
              publicKey,
              walletType,
              isConnecting: false,
              error: null,
            });
            console.log('🔐 [DirectWallet] Restored connection:', walletType, publicKey);
          } else {
            // Connection changed, clear stored data
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          // Wallet not connected, clear stored data
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [getProvider]);

  // Listen for wallet disconnect events
  useEffect(() => {
    if (!state.walletType || !state.isConnected) return;

    const provider = getProvider(state.walletType);
    if (!provider) return;

    const handleDisconnect = () => {
      console.log('🔐 [DirectWallet] Wallet disconnected');
      localStorage.removeItem(STORAGE_KEY);
      setState({
        isConnected: false,
        publicKey: null,
        walletType: null,
        isConnecting: false,
        error: null,
      });
    };

    provider.on?.('disconnect', handleDisconnect);

    return () => {
      provider.off?.('disconnect', handleDisconnect);
    };
  }, [state.walletType, state.isConnected, getProvider]);

  // Connect to wallet
  const connect = useCallback(async (walletType: 'phantom' | 'backpack' | 'solflare'): Promise<string | null> => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = getProvider(walletType);

      if (!provider) {
        const walletNames = {
          phantom: 'Phantom',
          backpack: 'Backpack',
          solflare: 'Solflare',
        };
        throw new Error(`${walletNames[walletType]} wallet not detected. Please install it first.`);
      }

      console.log('🔐 [DirectWallet] Connecting to', walletType);

      // Connect to wallet - this will show the wallet popup
      const response = await provider.connect();
      const publicKey = response.publicKey?.toString() || provider.publicKey?.toString();

      if (!publicKey) {
        throw new Error('Failed to get wallet public key');
      }

      console.log('✅ [DirectWallet] Connected:', publicKey);

      // Store connection for persistence
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ walletType, publicKey }));

      setState({
        isConnected: true,
        publicKey,
        walletType,
        isConnecting: false,
        error: null,
      });

      return publicKey;
    } catch (error: any) {
      console.error('❌ [DirectWallet] Connection failed:', error);

      // Handle user rejection
      const message = error.message?.includes('User rejected')
        ? 'Connection rejected. Please try again.'
        : error.message || 'Failed to connect wallet';

      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));

      return null;
    }
  }, [getProvider]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    if (state.walletType) {
      const provider = getProvider(state.walletType);
      provider?.disconnect?.();
    }

    localStorage.removeItem(STORAGE_KEY);

    setState({
      isConnected: false,
      publicKey: null,
      walletType: null,
      isConnecting: false,
      error: null,
    });

    console.log('🔐 [DirectWallet] Disconnected');
  }, [state.walletType, getProvider]);

  // Sign a message (for verification)
  const signMessage = useCallback(async (message: string): Promise<Uint8Array | null> => {
    if (!state.walletType || !state.isConnected) {
      console.error('No wallet connected');
      return null;
    }

    try {
      const provider = getProvider(state.walletType);
      if (!provider) return null;

      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await provider.signMessage(encodedMessage, 'utf8');

      return signedMessage.signature || signedMessage;
    } catch (error) {
      console.error('Failed to sign message:', error);
      return null;
    }
  }, [state.walletType, state.isConnected, getProvider]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <DirectWalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        signMessage,
        clearError,
      }}
    >
      {children}
    </DirectWalletContext.Provider>
  );
}

export function useDirectWallet() {
  const context = useContext(DirectWalletContext);
  if (!context) {
    throw new Error('useDirectWallet must be used within a DirectWalletProvider');
  }
  return context;
}
