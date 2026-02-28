/**
 * Root Layout - PNL Mobile App
 * Provider stack: Config → Privy → SWR → Network → Auth → GestureHandler → Stack Navigator
 */

import '../src/config/init'; // Must be first - polyfills + env config

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SWRConfig } from 'swr';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PrivyProvider, PrivyElements } from '@privy-io/expo';
import { NetworkProvider } from '@pnl/shared/contexts';
import { swrConfig } from '@pnl/shared/services';
import { PRIVY_APP_ID } from '../src/config/init';
import { AuthProvider } from '../src/providers/AuthProvider';
import { VoiceRoomProvider } from '../src/providers/VoiceRoomProvider';
import { StarField } from '../src/components';
import { MiniVoiceBar } from '../src/components/community';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

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
          name="login"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </StarField>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrivyProvider appId={PRIVY_APP_ID}>
        <PrivyElements />
        <SWRConfig value={swrConfig}>
          <NetworkProvider>
            <AuthProvider>
              <VoiceRoomProvider>
                <AppContent />
                <MiniVoiceBar />
              </VoiceRoomProvider>
            </AuthProvider>
          </NetworkProvider>
        </SWRConfig>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}
