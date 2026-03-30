/**
 * Root Layout - PNL Mobile App
 * Provider stack: Config → Privy → SWR → Network → Auth → GestureHandler → Stack Navigator
 */

import '../src/config/init'; // Must be first - polyfills + env config

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, usePathname } from 'expo-router';
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

function AppContent() {
  const pathname = usePathname();
  const voiceRoom = useVoiceRoomContextSafe();

  // Extract market ID from pathname (useLocalSearchParams doesn't work in _layout for nested routes)
  const currentMarketId = pathname?.startsWith('/market/')
    ? pathname.replace('/market/', '').split('/')[0] || null
    : null;

  // Hide mini bar when on the voice-rooms screen (it has its own header)
  const isOnVoiceRoomsScreen = pathname === '/voice-rooms';

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Handle pnl://voice/leave deep link from Dynamic Island
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url === 'pnl://voice/leave') {
        voiceRoom?.leave();
      }
    });

    // Check initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url === 'pnl://voice/leave') {
        voiceRoom?.leave();
      }
    });

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
