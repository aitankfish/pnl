/**
 * SWR Provider
 * Wraps the app with centralized SWR configuration
 */

'use client';

import { SWRConfig } from 'swr';
import { swrConfig } from '@/lib/swr-config';
import { ReactNode } from 'react';

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  );
}

export default SWRProvider;
