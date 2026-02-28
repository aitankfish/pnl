/**
 * PNL Reanimated Spring Presets
 */

import { WithSpringConfig } from 'react-native-reanimated';

export const springs: Record<string, WithSpringConfig> = {
  gentle: { damping: 20, stiffness: 150, mass: 1 },
  snappy: { damping: 15, stiffness: 300, mass: 0.8 },
  bouncy: { damping: 10, stiffness: 200, mass: 0.6 },
} as const;
