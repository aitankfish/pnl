/**
 * PNL Typography Scale
 */

import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  display: { fontSize: 32, fontWeight: '700', letterSpacing: -0.2 },
  heading: { fontSize: 24, fontWeight: '600', letterSpacing: -0.2 },
  title: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 14, fontWeight: '400' },
  micro: { fontSize: 12, fontWeight: '500' },
} as const;
