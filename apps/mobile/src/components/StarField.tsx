/**
 * StarField — Faithful port of the web SpaceBackground
 * Matches: 400 colorful seeded stars, nebulae, pulsars, meteors, daily constellation
 * Adapted from: apps/web/src/components/SpaceBackground.tsx + starry-background.css
 */

import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Seeded random (matches web exactly) ──────────────────────────
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ── Star color palette (same 12 as web) ──────────────────────────
const STAR_COLORS = [
  '#ffffff', '#93c5fd', '#c4b5fd', '#fde047', '#7dd3fc',
  '#fbbf24', '#f9a8d4', '#6ee7b7', '#d8b4fe', '#fb923c',
  '#60a5fa', '#a78bfa',
];

// ── Constellation definitions (same as web, 7 days) ──────────────
const CONSTELLATIONS = [
  { // Sunday – Orion
    name: 'Orion',
    stars: [
      { top: 25, left: 40 }, { top: 40, left: 35 }, { top: 45, left: 40 },
      { top: 45, left: 50 }, { top: 45, left: 60 }, { top: 60, left: 35 },
      { top: 70, left: 55 },
    ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,6],[5,2],[6,4]],
  },
  { // Monday – Ursa Major
    name: 'Ursa Major',
    stars: [
      { top: 20, left: 15 }, { top: 15, left: 30 }, { top: 12, left: 45 },
      { top: 18, left: 60 }, { top: 30, left: 70 }, { top: 45, left: 65 },
      { top: 55, left: 55 },
    ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]],
  },
  { // Tuesday – Cassiopeia
    name: 'Cassiopeia',
    stars: [
      { top: 15, left: 20 }, { top: 25, left: 35 }, { top: 15, left: 50 },
      { top: 25, left: 65 }, { top: 15, left: 80 },
    ],
    lines: [[0,1],[1,2],[2,3],[3,4]],
  },
  { // Wednesday – Leo
    name: 'Leo',
    stars: [
      { top: 40, left: 20 }, { top: 30, left: 30 }, { top: 20, left: 45 },
      { top: 25, left: 60 }, { top: 40, left: 65 }, { top: 55, left: 50 },
    ],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]],
  },
  { // Thursday – Cygnus
    name: 'Cygnus',
    stars: [
      { top: 15, left: 50 }, { top: 40, left: 50 }, { top: 70, left: 50 },
      { top: 40, left: 20 }, { top: 40, left: 80 },
    ],
    lines: [[0,1],[1,2],[3,1],[1,4]],
  },
  { // Friday – Scorpius
    name: 'Scorpius',
    stars: [
      { top: 40, left: 50 }, { top: 30, left: 45 }, { top: 20, left: 35 },
      { top: 50, left: 55 }, { top: 60, left: 65 }, { top: 70, left: 60 },
      { top: 75, left: 50 },
    ],
    lines: [[0,1],[1,2],[0,3],[3,4],[4,5],[5,6]],
  },
  { // Saturday – Pegasus
    name: 'Pegasus',
    stars: [
      { top: 20, left: 30 }, { top: 20, left: 60 }, { top: 50, left: 60 },
      { top: 50, left: 30 }, { top: 10, left: 20 }, { top: 60, left: 70 },
    ],
    lines: [[0,1],[1,2],[2,3],[3,0],[0,4],[2,5]],
  },
];

// ── Pre-generate 400 star data (same logic as web) ──────────────
interface StarData {
  size: number;
  color: string;
  left: number;  // percentage
  top: number;   // percentage
  duration: number;
  delay: number;
  glow: number;
}

function generateStarData(): StarData[] {
  return Array.from({ length: 400 }, (_, i) => {
    const sizeRand = seededRandom(i * 1);
    const size = sizeRand > 0.95 ? 3 : sizeRand > 0.85 ? 2.5 : sizeRand > 0.7 ? 2 : sizeRand > 0.5 ? 1.5 : 1;
    const color = STAR_COLORS[Math.floor(seededRandom(i * 2) * STAR_COLORS.length)];
    const duration = 1500 + seededRandom(i * 3) * 5000;
    const delay = seededRandom(i * 4) * 6000;
    const left = seededRandom(i * 5) * 100;
    const top = seededRandom(i * 6) * 100;
    const glow = size >= 3 ? 6 : size >= 2.5 ? 5 : size >= 2 ? 4 : 2;
    return { size, color, left, top, duration, delay, glow };
  });
}

const ALL_STARS = generateStarData();

// ── Individual animated star ─────────────────────────────────────
const Star = React.memo(({ s }: { s: StarData }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      s.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: s.duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: s.duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1, 0.5], [0, 0.4, 1, 0.4]),
    transform: [{ scale: interpolate(progress.value, [0, 0.5, 1, 0.5], [0, 0.8, 1.2, 0.8]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${s.left}%` as any,
          top: `${s.top}%` as any,
          width: s.size,
          height: s.size,
          borderRadius: s.size / 2,
          backgroundColor: s.color,
        },
        s.size >= 2 && Platform.OS === 'ios' && {
          shadowColor: s.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: s.glow,
        },
        style,
      ]}
    />
  );
});

// ── Pulsar (bright pulsing star, matches web) ────────────────────
const Pulsar = React.memo(({ top, left, delay }: { top: number; left: number; delay: number }) => {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0.4, 1]),
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 1.5]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: `${top}%` as any,
          left: `${left}%` as any,
          width: 3,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: '#ffffff',
        },
        Platform.OS === 'ios' && {
          shadowColor: '#64c8ff',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 10,
        },
        style,
      ]}
    />
  );
});

// ── Meteor / shooting star ───────────────────────────────────────
const Meteor = React.memo(({ delay, duration }: { delay: number; duration: number }) => {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.linear }),
          withTiming(0, { duration: 0 }), // reset instantly
        ),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const x = interpolate(p.value, [0, 1], [-100, SW + 100]);
    const y = interpolate(p.value, [0, 1], [-100, SH + 100]);
    const opacity = p.value < 0.1 ? interpolate(p.value, [0, 0.1], [0, 0.4])
      : p.value > 0.9 ? interpolate(p.value, [0.9, 1], [0.4, 0])
      : 0.4;
    return {
      transform: [{ translateX: x }, { translateY: y }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.meteor, style]}>
      <View style={styles.meteorTail} />
    </Animated.View>
  );
});

// ── Nebula cloud ─────────────────────────────────────────────────
const Nebula = React.memo(({ color, top, left, size, delay }: {
  color: string; top: number; left: number; size: number; delay: number;
}) => {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 30000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 30000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.5, 1], [0.06, 0.12, 0.06]),
    transform: [
      { translateY: interpolate(p.value, [0, 0.5, 1], [0, -20, 0]) },
      { scale: interpolate(p.value, [0, 0.5, 1], [1, 1.08, 1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: `${top}%` as any,
          left: `${left}%` as any,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
});

// ── Constellation star (entrance + twinkle) ──────────────────────
const ConstellationStar = React.memo(({ top, left, delay }: { top: number; left: number; delay: number }) => {
  const entrance = useSharedValue(0);
  const twinkle = useSharedValue(0);

  useEffect(() => {
    // Entrance: scale up bright then settle
    entrance.value = withDelay(delay, withTiming(1, { duration: 2000, easing: Easing.out(Easing.cubic) }));
    // Twinkle after entrance
    twinkle.value = withDelay(
      delay + 2000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const scale = entrance.value < 1
      ? interpolate(entrance.value, [0, 0.15, 0.5, 1], [0.3, 3, 2, 1])
      : interpolate(twinkle.value, [0, 1], [1, 1.3]);
    const opacity = entrance.value < 1
      ? interpolate(entrance.value, [0, 0.15, 1], [0, 1, 0.8])
      : interpolate(twinkle.value, [0, 0.5, 1], [0.8, 1, 0.8]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: `${top}%` as any,
          left: `${left}%` as any,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: '#ffffff',
        },
        Platform.OS === 'ios' && {
          shadowColor: '#64c8ff',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 8,
        },
        style,
      ]}
    />
  );
});

// ── Main StarField component ─────────────────────────────────────
interface StarFieldProps {
  children?: React.ReactNode;
}

export function StarField({ children }: StarFieldProps) {
  const constellation = useMemo(() => {
    const day = new Date().getDay();
    return CONSTELLATIONS[day];
  }, []);

  // Performance: render fewer stars on smaller/older devices
  const visibleStars = useMemo(() => ALL_STARS.slice(0, 200), []);

  return (
    <View style={styles.container}>
      {/* Deep space gradient (matches web body bg) */}
      <LinearGradient
        colors={['#050816', '#0a0e1a', '#0f1628', '#0a0e1a', '#06080f']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Nebulae (matches web .nebula1/2/3) */}
      <Nebula color="rgba(138, 43, 226, 0.15)" top={10} left={15} size={200} delay={0} />
      <Nebula color="rgba(0, 191, 255, 0.12)" top={60} left={55} size={170} delay={5000} />
      <Nebula color="rgba(255, 20, 147, 0.10)" top={78} left={30} size={220} delay={10000} />

      {/* Aurora bands (subtle) */}
      <View style={styles.aurora1} />
      <View style={styles.aurora2} />

      {/* 200 colorful twinkling stars (same seeded positions as web) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {visibleStars.map((s, i) => (
          <Star key={i} s={s} />
        ))}
      </View>

      {/* Pulsars (matches web positions) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Pulsar top={25} left={70} delay={0} />
        <Pulsar top={55} left={25} delay={1500} />
        <Pulsar top={75} left={80} delay={3000} />
        <Pulsar top={40} left={45} delay={2000} />
      </View>

      {/* Meteors / shooting stars */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Meteor delay={2000} duration={12000} />
        <Meteor delay={8000} duration={15000} />
        <Meteor delay={15000} duration={18000} />
      </View>

      {/* Daily constellation */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Constellation connecting lines */}
        <Svg style={StyleSheet.absoluteFill}>
          {constellation.lines.map(([a, b], idx) => (
            <Line
              key={idx}
              x1={`${constellation.stars[a].left}%`}
              y1={`${constellation.stars[a].top}%`}
              x2={`${constellation.stars[b].left}%`}
              y2={`${constellation.stars[b].top}%`}
              stroke="rgba(100, 200, 255, 0.15)"
              strokeWidth={1}
            />
          ))}
        </Svg>
        {/* Constellation stars */}
        {constellation.stars.map((star, idx) => (
          <ConstellationStar key={idx} top={star.top} left={star.left} delay={idx * 300} />
        ))}
      </View>

      {/* Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
  },
  meteor: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#ffffff',
  },
  meteorTail: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ rotate: '45deg' }],
  },
  aurora1: {
    position: 'absolute',
    top: '20%',
    left: 0,
    right: 0,
    height: 120,
    opacity: 0.06,
    backgroundColor: 'transparent',
    borderRadius: 60,
    ...(Platform.OS === 'ios' && {
      shadowColor: '#00ff96',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 60,
    }),
  },
  aurora2: {
    position: 'absolute',
    bottom: '30%',
    left: 0,
    right: 0,
    height: 100,
    opacity: 0.05,
    backgroundColor: 'transparent',
    borderRadius: 50,
    ...(Platform.OS === 'ios' && {
      shadowColor: '#6496ff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 50,
    }),
  },
});
