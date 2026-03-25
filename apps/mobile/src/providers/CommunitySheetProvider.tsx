/**
 * CommunitySheetProvider — Global context for the floating community bottom sheet.
 *
 * Allows any screen (feed, explore, etc.) to open the community sheet
 * with Chat + Voice tabs without navigating to the market detail page.
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface CommunitySheetMarket {
  marketId: string;
  marketAddress: string;
  marketName: string;
  marketDescription?: string | null;
  founderWallet: string | null;
}

interface CommunitySheetContextType {
  /** Current market data for the sheet (null = closed) */
  market: CommunitySheetMarket | null;
  /** Which sub-tab to open on */
  initialSubTab: 'Chat' | 'Voice';
  /** If true, auto-join voice room as speaker (for empty rooms in discovery mode) */
  autoJoinAsSpeaker: boolean;
  /** Open the sheet for a given market */
  open: (market: CommunitySheetMarket, subTab?: 'Chat' | 'Voice', autoSpeaker?: boolean) => void;
  /** Close the sheet */
  close: () => void;
}

const CommunitySheetContext = createContext<CommunitySheetContextType | null>(null);

export function useCommunitySheet() {
  const ctx = useContext(CommunitySheetContext);
  if (!ctx) throw new Error('useCommunitySheet must be used within CommunitySheetProvider');
  return ctx;
}

export function useCommunitySheetSafe() {
  return useContext(CommunitySheetContext);
}

export function CommunitySheetProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<CommunitySheetMarket | null>(null);
  const [initialSubTab, setInitialSubTab] = useState<'Chat' | 'Voice'>('Voice');
  const [autoJoinAsSpeaker, setAutoJoinAsSpeaker] = useState(false);

  // Remember description per market so mini bar re-open retains it
  const descCacheRef = useRef<Record<string, string>>({});

  const open = useCallback((m: CommunitySheetMarket, subTab: 'Chat' | 'Voice' = 'Voice', autoSpeaker = false) => {
    // Cache description if provided
    if (m.marketDescription) {
      descCacheRef.current[m.marketAddress] = m.marketDescription;
    }

    // Fill in cached description if missing (e.g. re-open from mini bar)
    const desc = m.marketDescription || descCacheRef.current[m.marketAddress] || null;

    setMarket({ ...m, marketDescription: desc });
    setInitialSubTab(subTab);
    setAutoJoinAsSpeaker(autoSpeaker);
  }, []);

  const close = useCallback(() => {
    setMarket(null);
    setAutoJoinAsSpeaker(false);
  }, []);

  return (
    <CommunitySheetContext.Provider value={{ market, initialSubTab, autoJoinAsSpeaker, open, close }}>
      {children}
    </CommunitySheetContext.Provider>
  );
}
