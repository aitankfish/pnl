/**
 * ListenerStars — Each listener in the voice room becomes a twinkling star
 * scattered across the background. More listeners = more stars.
 * Star size is randomized (can be driven by pool size when available).
 */

import { useMemo, useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_STARS = 120; // Cap for performance

// Star tiers based on "importance" (randomized for now, can use pool size later)
const STAR_TIERS = [
  { size: 2, color: 'rgba(255,255,255,0.3)', weight: 50 },   // small dim
  { size: 3, color: 'rgba(255,255,255,0.5)', weight: 25 },   // medium
  { size: 4, color: 'rgba(167,139,250,0.6)', weight: 12 },   // medium purple
  { size: 5, color: 'rgba(129,140,248,0.7)', weight: 8 },    // larger indigo
  { size: 6, color: 'rgba(255,255,255,0.8)', weight: 4 },    // bright
  { size: 8, color: 'rgba(167,139,250,0.9)', weight: 1 },    // rare big purple
];

function pickTier(seed: number) {
  const totalWeight = STAR_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = (seed * 9301 + 49297) % totalWeight; // deterministic pseudo-random
  for (const tier of STAR_TIERS) {
    r -= tier.weight;
    if (r <= 0) return tier;
  }
  return STAR_TIERS[0];
}

interface StarData {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

interface ListenerStarsProps {
  listenerCount: number;
}

function generateStars(count: number): StarData[] {
  const starCount = Math.min(count, MAX_STARS);
  const stars: StarData[] = [];

  for (let i = 0; i < starCount; i++) {
    const tier = pickTier(i);
    // Spread across full area with some padding
    const x = ((i * 7919 + 104729) % (SCREEN_WIDTH - 20)) + 10;
    const y = ((i * 6271 + 32749) % (SCREEN_HEIGHT * 0.6)) + 20;
    const delay = ((i * 3571) % 3000); // 0-3s stagger
    const duration = 1500 + ((i * 2137) % 2500); // 1.5-4s twinkle

    stars.push({
      id: `star-${i}`,
      x,
      y,
      size: tier.size,
      color: tier.color,
      delay,
      duration,
    });
  }

  return stars;
}

function TwinklingStar({ star }: { star: StarData }) {
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withTiming(1, {
          duration: star.duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );
  }, [star.delay, star.duration, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        animatedStyle,
        {
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.color,
          // Glow for bigger stars
          ...(star.size >= 5 && {
            shadowColor: star.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: star.size,
          }),
        },
      ]}
    />
  );
}

export function ListenerStars({ listenerCount }: ListenerStarsProps) {
  const stars = useMemo(() => generateStars(listenerCount), [listenerCount]);

  if (listenerCount === 0) return null;

  return (
    <>
      {stars.map((star) => (
        <TwinklingStar key={star.id} star={star} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
  },
});
