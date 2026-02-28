/**
 * PNL Typography Scale
 */

import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  display: { fontSize: 32, fontWeight: '700', letterSpacing: -0.2, lineHeight: 38 },
  heading: { fontSize: 24, fontWeight: '600', letterSpacing: -0.2, lineHeight: 30 },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  bodyBold: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  caption: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  captionBold: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  micro: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  tabLabel: { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 0.3 },
  numeric: { fontSize: 16, fontWeight: '700', lineHeight: 22, fontVariant: ['tabular-nums'] },
  numericLarge: { fontSize: 28, fontWeight: '700', lineHeight: 34, fontVariant: ['tabular-nums'] },
} as const;
