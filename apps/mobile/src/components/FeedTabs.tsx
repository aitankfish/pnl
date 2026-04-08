import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { springs } from '../theme/animations';

const TABS = ['Feed', 'For You'];

interface FeedTabsProps {
  activeIndex: number;
  onTabPress: (index: number) => void;
}

export function FeedTabs({ activeIndex, onTabPress }: FeedTabsProps) {
  const tabWidths = useSharedValue<number[]>([0, 0]);
  const tabOffsets = useSharedValue<number[]>([0, 0]);

  const handleTabLayout = (index: number, x: number, width: number) => {
    tabWidths.value = tabWidths.value.map((w, i) => (i === index ? width : w));
    tabOffsets.value = tabOffsets.value.map((o, i) => (i === index ? x : o));
  };

  const underlineStyle = useAnimatedStyle(() => {
    const w = tabWidths.value[activeIndex];
    const x = tabOffsets.value[activeIndex];
    if (!w) return { opacity: 0 };
    return {
      opacity: 1,
      width: withSpring(w, springs.snappy),
      transform: [{ translateX: withSpring(x, springs.snappy) }],
    };
  });

  return (
    <View style={styles.container}>
      {/* tabRow is the positioning parent for both tabs and underline */}
      <View style={styles.tabRow}>
        {TABS.map((label, i) => {
          const isActive = i === activeIndex;
          return (
            <Pressable
              key={label}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onTabPress(i);
              }}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                handleTabLayout(i, x, width);
              }}
              hitSlop={8}
              style={styles.tab}
            >
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
        {/* Underline inside tabRow so x offsets match */}
        <Animated.View style={[styles.underline, underlineStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 28,
    position: 'relative',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
  },
  labelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  underline: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
});
