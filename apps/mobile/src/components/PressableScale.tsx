import React, { useCallback } from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { springs } from '../theme/animations';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  scaleDown?: number;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({
  scaleDown = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      scale.value = withSpring(scaleDown, springs.snappy);
      onPressIn?.(e);
    },
    [scaleDown, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withSpring(1, springs.bouncy);
      onPressOut?.(e);
    },
    [onPressOut],
  );

  const handlePress = useCallback(
    (e: any) => {
      if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(e);
    },
    [haptic, onPress],
  );

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
