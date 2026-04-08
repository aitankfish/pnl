import React, { useEffect } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { springs } from '../theme/animations';

interface NewProjectsPillProps {
  count: number;
  visible: boolean;
  onPress: () => void;
  top?: number;
}

export function NewProjectsPill({ count, visible, onPress, top }: NewProjectsPillProps) {
  const translateY = useSharedValue(-60);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible && count > 0) {
      translateY.value = withSpring(0, springs.snappy);
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(-60, springs.gentle);
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, count, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible && count === 0) return null;

  return (
    <Animated.View style={[styles.wrapper, top != null && { top }, animStyle]}>
      <Pressable
        style={styles.pill}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <Ionicons name="sparkles" size={14} color="#e9d5ff" />
        <Text style={styles.text}>
          {count} new project{count !== 1 ? 's' : ''}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 45,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
