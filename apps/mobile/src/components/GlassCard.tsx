import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet, StyleProp } from 'react-native';
import { colors, borderRadius } from '../theme';

interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GlassCard({ children, style }: GlassCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
});
