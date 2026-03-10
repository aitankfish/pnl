/**
 * VoteToast — Non-blocking floating toast for vote status feedback.
 * Shows at top of screen, auto-dismisses, doesn't block scrolling.
 */

import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export type VoteToastState = {
  visible: boolean;
  stage: 'signing' | 'confirming' | 'success' | 'error';
  direction?: 'yes' | 'no';
  amount?: number;
  marketName?: string;
  message?: string;
};

// Colors based on vote direction
const YES_COLOR = '#10b981';
const NO_COLOR = '#ef4444';
const NEUTRAL_COLOR = '#a78bfa';
const AMBER_COLOR = '#f59e0b';

function getStageConfig(stage: VoteToastState['stage'], direction?: 'yes' | 'no') {
  const dirColor = direction === 'no' ? NO_COLOR : YES_COLOR;

  switch (stage) {
    case 'signing':
      return { icon: 'wallet-outline' as const, color: direction ? dirColor : NEUTRAL_COLOR };
    case 'confirming':
      return { icon: 'hourglass-outline' as const, color: AMBER_COLOR };
    case 'success':
      return { icon: 'checkmark-circle' as const, color: dirColor };
    case 'error':
      return { icon: 'close-circle' as const, color: NO_COLOR };
  }
}

function buildLabel(state: VoteToastState): string {
  const { stage, direction, amount, marketName } = state;
  const dirLabel = direction === 'no' ? 'NO' : 'YES';
  const name = marketName ? ` on ${marketName}` : '';
  const sol = amount ? `${amount} SOL` : '';

  switch (stage) {
    case 'signing':
      return `Signing ${dirLabel} vote of ${sol}${name}...`;
    case 'confirming':
      return `Confirming ${dirLabel} ${sol}${name}...`;
    case 'success':
      return `Voted ${dirLabel} ${sol}${name}`;
    case 'error':
      return state.message || `Vote failed${name}`;
  }
}

interface VoteToastProps {
  state: VoteToastState;
  onDismiss: () => void;
}

export function VoteToast({ state, onDismiss }: VoteToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (state.visible) {
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });

      if (state.stage === 'success' || state.stage === 'error') {
        // Auto-dismiss after 3s
        translateY.value = withDelay(3000, withTiming(-100, { duration: 300 }));
        opacity.value = withDelay(3000, withTiming(0, { duration: 300 }));
        const timer = setTimeout(onDismiss, 3300);
        return () => clearTimeout(timer);
      }
    } else {
      translateY.value = withTiming(-100, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [state.visible, state.stage]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!state.visible) return null;

  const config = getStageConfig(state.stage, state.direction);
  const label = buildLabel(state);

  return (
    <Animated.View
      style={[styles.container, { top: insets.top + 8 }, animStyle]}
      pointerEvents="none"
    >
      <View style={[styles.toast, { borderColor: config.color + '55' }]}>
        <Ionicons name={config.icon} size={18} color={config.color} />
        <Text style={styles.text} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 14, 26, 0.94)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flexShrink: 1,
  },
});
