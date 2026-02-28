/**
 * PNL Spacing System (8px grid)
 */

import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 } as const;

export const safeAreaFallback = {
  top: Platform.OS === 'ios' ? 50 : 30,
  bottom: Platform.OS === 'ios' ? 34 : 24,
} as const;

export const touchTarget = Platform.OS === 'ios' ? 44 : 48;
