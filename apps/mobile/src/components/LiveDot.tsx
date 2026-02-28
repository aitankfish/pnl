import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';

interface LiveDotProps {
  size?: number;
  style?: ViewStyle;
}

export function LiveDot({ size = 8, style }: LiveDotProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.3, { duration: 1000 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2 },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: colors.livePulse,
  },
});
