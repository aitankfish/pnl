import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius } from '../theme';
import { springs } from '../theme/animations';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export interface StatusTab {
  value: string;
  label: string;
}

interface StatusTabsProps {
  tabs: StatusTab[];
  selectedTab: string;
  onTabChange: (value: string) => void;
}

export function StatusTabs({ tabs, selectedTab, onTabChange }: StatusTabsProps) {
  const segmentWidth = useSharedValue(0);
  const activeIndex = tabs.findIndex((t) => t.value === selectedTab);

  const handleLayout = (e: LayoutChangeEvent) => {
    const totalWidth = e.nativeEvent.layout.width;
    segmentWidth.value = totalWidth / tabs.length;
  };

  const indicatorStyle = useAnimatedStyle(() => {
    if (segmentWidth.value === 0) return { opacity: 0 };
    return {
      opacity: 1,
      width: segmentWidth.value,
      transform: [
        {
          translateX: withSpring(activeIndex * segmentWidth.value, springs.snappy),
        },
      ],
    };
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.container} onLayout={handleLayout}>
        {/* Sliding indicator */}
        <AnimatedLinearGradient
          colors={['#8b5cf6', '#06b6d4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.indicator, indicatorStyle]}
        />

        {/* Tab segments */}
        {tabs.map((tab) => {
          const isActive = selectedTab === tab.value;
          return (
            <PressableScale
              key={tab.value}
              onPress={() => onTabChange(tab.value)}
              scaleDown={0.97}
              style={styles.segment}
            >
              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {tab.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    height: 36,
    backgroundColor: colors.glass,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: borderRadius.lg - 1,
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  activeLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
