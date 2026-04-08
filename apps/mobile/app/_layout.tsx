/**
 * Root Layout - PNL Mobile App
 * Provider stack: Config → Privy → SWR → Network → Auth → GestureHandler → Stack Navigator
 */

import '../src/config/init'; // Must be first - polyfills + env config

import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, usePathname, router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { SWRConfig } from 'swr';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PrivyProvider } from '@privy-io/expo';
import { PrivyElements } from '@privy-io/expo/ui';
import { NetworkProvider } from '@pnl/shared/contexts';
import { swrConfig } from '@pnl/shared/services';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from '../src/config/init';
import { AuthProvider } from '../src/providers/AuthProvider';
import { VoiceRoomProvider, useVoiceRoomContextSafe } from '../src/providers/VoiceRoomProvider';
import { StarField } from '../src/components';
import { MiniVoiceBar } from '../src/components/community';

SplashScreen.preventAutoHideAsync();

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
      backgroundColor: '#ef4444', paddingTop: 54, paddingBottom: 6,
      alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
        No internet connection
      </Text>
    </View>
  );
}

function AppContent() {
  const pathname = usePathname();
  const voiceRoom = useVoiceRoomContextSafe();

  // Extract market ID from pathname (useLocalSearchParams doesn't work in _layout for nested routes)
  const currentMarketId = pathname?.startsWith('/market/')
    ? pathname.replace('/market/', '').split('/')[0] || null
    : null;

  // Hide mini bar on voice-rooms and chat screens (they have their own headers)
  const isOnVoiceRoomsScreen = pathname === '/voice-rooms' || pathname?.startsWith('/chat/');

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Handle deep links: pnl://market/[id], pnl://profile/[wallet], pnl://voice/leave
  const handleDeepLink = (url: string | null) => {
    if (!url) return;
    if (url === 'pnl://voice/leave') { voiceRoom?.leave(); return; }
    try {
      // Parse pnl://market/abc123 → hostname='market', pathname='/abc123'
      const parsed = new URL(url);
      const host = parsed.hostname;
      const path = parsed.pathname.replace(/^\//, '');
      if (host === 'market' && path) router.push(`/market/${path}` as any);
      else if (host === 'profile' && path) router.push(`/profile/${path}` as any);
      else if (host === 'voice' && path) router.push({ pathname: '/voice-rooms', params: { marketAddress: path } } as any);
    } catch {}
  };

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then(handleDeepLink);
    return () => subscription.remove();
  }, [voiceRoom]);

  return (
    <StarField>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="market/[id]"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="profile/[wallet]"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="create"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      {!isOnVoiceRoomsScreen && <MiniVoiceBar currentMarketId={currentMarketId} />}
    </StarField>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OfflineBanner />
      <PrivyProvider
        appId={PRIVY_APP_ID}
        clientId={PRIVY_CLIENT_ID}
        config={{
          embedded: {
            solana: {
              createOnLogin: 'all-users',
            },
          },
        }}
      >
        <PrivyElements />
        <SWRConfig value={swrConfig}>
          <NetworkProvider>
            <AuthProvider>
              <VoiceRoomProvider>
                <AppContent />
              </VoiceRoomProvider>
            </AuthProvider>
          </NetworkProvider>
        </SWRConfig>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}
