import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

interface NewBadgeProps {
  visible: boolean;
}

export function NewBadge({ visible }: NewBadgeProps) {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      // Shimmer: pulse opacity 3 times, then fade out after 3s
      opacity.value = withSequence(
        withTiming(1, { duration: 0 }),
        withRepeat(
          withSequence(
            withTiming(0.5, { duration: 400 }),
            withTiming(1, { duration: 400 }),
          ),
          3, // 3 shimmer cycles (~2.4s)
          false,
        ),
        withDelay(600, withTiming(0, { duration: 500 })),
      );
    } else {
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.badge, animStyle]}>
      <Animated.Text style={styles.text}>NEW</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 20,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
