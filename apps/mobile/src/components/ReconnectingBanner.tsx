/**
 * ReconnectingBanner
 *
 * Surfaces the WebSocket reconnection state. Shows a subtle amber bar
 * when the device has internet but our socket is disconnected for >2s.
 * Stays out of the way during normal brief reconnects.
 *
 * Sits above OfflineBanner in stacking order: when the device is fully
 * offline, OfflineBanner takes over and this hides itself.
 */

import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSocket } from '@pnl/shared/hooks';

// 2s grace window absorbs the natural reconnect cycle (1s backoff start)
// so users only see the banner during real outages, not normal blips.
const SHOW_DELAY_MS = 2000;

export function ReconnectingBanner() {
  // Note: this opens its own socket (small cost; socket.io clients are cheap).
  // If we ever consolidate sockets through a context, swap this for the shared one.
  const { isConnected: socketConnected } = useSocket();
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (socketConnected) {
      setShowBanner(false);
      return;
    }
    const timer = setTimeout(() => setShowBanner(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [socketConnected]);

  // OfflineBanner owns the no-network case (red). We only show on the
  // narrower "device online but socket flaky" condition.
  if (!isOnline || !showBanner) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        backgroundColor: '#f59e0b',
        paddingTop: 54,
        paddingBottom: 6,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#1a1300', fontSize: 12, fontWeight: '600' }}>
        Reconnecting…
      </Text>
    </View>
  );
}
