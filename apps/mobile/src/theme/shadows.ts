/**
 * PNL Platform Shadows
 */

import { Platform, ViewStyle } from 'react-native';

const ios = (offset: number, radius: number, opacity: number): ViewStyle => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: offset },
  shadowOpacity: opacity,
  shadowRadius: radius,
});

const android = (elevation: number): ViewStyle => ({ elevation });

export const shadows = {
  sm: Platform.select({ ios: ios(1, 3, 0.12), android: android(2) })!,
  md: Platform.select({ ios: ios(2, 8, 0.18), android: android(4) })!,
  lg: Platform.select({ ios: ios(4, 16, 0.25), android: android(8) })!,
  glow: Platform.select({
    ios: { shadowColor: '#818cf8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12 },
    android: android(6),
  })!,
} as const;
