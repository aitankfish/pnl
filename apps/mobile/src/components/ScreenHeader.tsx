import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../theme';

interface ScreenHeaderProps {
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
  transparent?: boolean;
  style?: ViewStyle;
}

export function ScreenHeader({ title, left, right, transparent, style }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 8 },
        transparent && styles.transparent,
        style,
      ]}
    >
      <View style={styles.side}>{left}</View>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  transparent: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  side: {
    width: 44,
    alignItems: 'center',
  },
});
