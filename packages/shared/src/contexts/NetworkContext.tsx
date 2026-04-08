/**
 * Network Context (shared)
 * Single source of truth for network state
 */

import React, { createContext, useContext, useState } from 'react';
import { getEnvConfig, isEnvConfigInitialized } from '../config';

export type SolanaNetwork = 'devnet' | 'mainnet-beta';

interface NetworkContextType {
  network: SolanaNetwork;
  setNetwork: (network: SolanaNetwork) => void;
  isMainnet: boolean;
  isDevnet: boolean;
  isDevelopment: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

  const getInitialNetwork = (): SolanaNetwork => {
    // Prefer explicit config from setEnvConfig() (mobile sets this in init.ts)
    if (isEnvConfigInitialized()) {
      return getEnvConfig().SOLANA_NETWORK;
    }
    // Fallback for web dev (before env config auto-inits from process.env)
    if (!isDevelopment) return 'mainnet-beta';
    return 'devnet';
  };

  const [network, setNetworkState] = useState<SolanaNetwork>(getInitialNetwork);

  const setNetwork = (newNetwork: SolanaNetwork) => {
    setNetworkState(newNetwork);
  };

  const value: NetworkContextType = {
    network,
    setNetwork,
    isMainnet: network === 'mainnet-beta',
    isDevnet: network === 'devnet',
    isDevelopment,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}
