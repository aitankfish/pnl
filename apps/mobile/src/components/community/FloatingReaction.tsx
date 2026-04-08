import { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';

interface FloatingReactionProps {
  emoji: string;
  onFinish: () => void;
}

export function FloatingReaction({ emoji, onFinish }: FloatingReactionProps) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.5);
  // Randomize horizontal position
  const translateX = useSharedValue((Math.random() - 0.5) * 80);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 200 }),
      withTiming(1, { duration: 100 }),
    );
    translateY.value = withTiming(-120, { duration: 2500 });
    opacity.value = withTiming(0, { duration: 2800 }, () => {
      runOnJS(onFinish)();
    });
  }, [translateY, opacity, scale, onFinish]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
  emoji: {
    fontSize: 28,
  },
});
