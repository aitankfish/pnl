'use client';

import { useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';

const POLL_MS = 60 * 1000;

/**
 * Polls the citation inbox for pending requests addressed to the
 * connected wallet. Returns just the count so badge consumers don't need
 * to refetch the full list. Stays silent when unauthenticated or when
 * the tab is hidden.
 */
export function usePendingCitations(): { count: number } {
  const { authenticated, primaryWallet } = useWallet();
  const [count, setCount] = useState(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !primaryWallet?.address) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        const res = await authFetch('/api/research/inbox?status=pending');
        const json = await res.json();
        if (cancelled) return;
        if (json?.success) {
          setCount(json.data?.pendingCount || 0);
        }
      } catch {
        // Silent — we don't surface inbox fetch errors at the masthead.
      }
    };

    tick();
    timer = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [authenticated, primaryWallet?.address]);

  return { count };
}
