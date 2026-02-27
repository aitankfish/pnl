/**
 * Wallet Provider for Mobile
 * Privy embedded wallet + deep links to Phantom/Solflare
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Linking, Alert } from 'react-native';

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: any) => Promise<any>;
  sendTransaction: (tx: any) => Promise<string>;
  openExternalWallet: (walletName: 'phantom' | 'solflare') => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  connect: async () => {},
  disconnect: async () => {},
  signTransaction: async (tx) => tx,
  sendTransaction: async () => '',
  openExternalWallet: () => {},
});

const WALLET_SCHEMES: Record<string, string> = {
  phantom: 'phantom://',
  solflare: 'solflare://',
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    // TODO: Integrate Privy embedded wallet
    // For now, placeholder
  }, []);

  const disconnect = useCallback(async () => {
    setAddress(null);
    setIsConnected(false);
  }, []);

  const signTransaction = useCallback(async (tx: any) => {
    // TODO: Use Privy wallet to sign
    return tx;
  }, []);

  const sendTransaction = useCallback(async (tx: any) => {
    // TODO: Use Privy wallet to send
    return '';
  }, []);

  const openExternalWallet = useCallback((walletName: 'phantom' | 'solflare') => {
    const scheme = WALLET_SCHEMES[walletName];
    Linking.canOpenURL(scheme).then((supported) => {
      if (supported) {
        Linking.openURL(scheme);
      } else {
        Alert.alert(
          `${walletName} not installed`,
          `Please install ${walletName} from the App Store.`
        );
      }
    });
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, isConnected, connect, disconnect, signTransaction, sendTransaction, openExternalWallet }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useMobileWallet() {
  return useContext(WalletContext);
}
