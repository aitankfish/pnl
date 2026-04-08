/**
 * Wallet Provider for Mobile
 * Privy embedded Solana wallet + deep links to external wallets
 */

import React, { createContext, useContext, useCallback } from 'react';
import { Linking, Alert } from 'react-native';
import { useAuth } from './AuthProvider';

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  openExternalWallet: (walletName: 'phantom' | 'solflare') => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  openExternalWallet: () => {},
});

const WALLET_SCHEMES: Record<string, string> = {
  phantom: 'phantom://',
  solflare: 'solflare://',
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { walletAddress, isAuthenticated } = useAuth();

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
      value={{
        address: walletAddress,
        isConnected: isAuthenticated && !!walletAddress,
        openExternalWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useMobileWallet() {
  return useContext(WalletContext);
}
