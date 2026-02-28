import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, typography } from '../theme';

interface TimeCountdownProps {
  endTime: string | Date;
  style?: ViewStyle;
}

function getTimeLeft(end: Date) {
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return { text: 'Ended', hours: 0 };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return { text: `${d}d ${h % 24}h`, hours: h };
  }
  return { text: `${h}h ${m}m`, hours: h };
}

export function TimeCountdown({ endTime, style }: TimeCountdownProps) {
  const end = new Date(endTime);
  const [left, setLeft] = useState(() => getTimeLeft(end));
  const pulse = useSharedValue(1);

  useEffect(() => {
    const interval = setInterval(() => setLeft(getTimeLeft(end)), 60000);
    return () => clearInterval(interval);
  }, [endTime]);

  useEffect(() => {
    if (left.hours < 1) {
      pulse.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
    }
  }, [left.hours]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: left.hours < 1 ? pulse.value : 1,
  }));

  const color =
    left.hours < 1 ? colors.urgentRed : left.hours < 6 ? colors.warning : colors.textSecondary;

  return (
    <Animated.View style={[styles.container, pulseStyle, style]}>
      <Text style={[styles.text, { color }]}>{left.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    ...typography.captionBold,
  },
});
