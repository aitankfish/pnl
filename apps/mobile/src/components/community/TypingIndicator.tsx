import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { colors, typography } from '../../theme';

interface TypingIndicatorProps {
  users: { displayName: string }[];
}

function AnimatedDot({ delay }: { delay: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 300 }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
      ),
    );
  }, [delay, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const text =
    users.length === 1
      ? `${users[0].displayName} is typing`
      : users.length === 2
        ? `${users[0].displayName} and ${users[1].displayName} are typing`
        : `${users[0].displayName} and ${users.length - 1} others are typing`;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.dots}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={150} />
        <AnimatedDot delay={300} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  text: {
    ...typography.micro,
    color: colors.textMuted,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
});
