/**
 * WelcomeCard — Minimalist full-screen welcome.
 * Clean typography on StarField. Swipe up curtain to reveal feed.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated as RNAnimated,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from './StarField';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius } from '../theme';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 100;

interface WelcomeCardProps {
  onSignIn: () => void;
  onDismiss: () => void;
}

export function WelcomeCard({ onSignIn, onDismiss }: WelcomeCardProps) {
  const translateY = useSharedValue(0);

  const contentOpacity = useRef(new RNAnimated.Value(0)).current;
  const bottomOpacity = useRef(new RNAnimated.Value(0)).current;
  const chevronAnim = useRef(new RNAnimated.Value(0)).current;

  const panGesture = Gesture.Pan()
    .activeOffsetY(-15)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationY < 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY < -DISMISS_THRESHOLD || e.velocityY < -500) {
        translateY.value = withTiming(-WINDOW_HEIGHT, { duration: 350 }, () => {
          runOnJS(onDismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const curtainStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateY.value, [-WINDOW_HEIGHT, 0], [1, 0], Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateY: translateY.value },
        { scaleX: interpolate(progress, [0, 1], [1, 0.94], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(progress, [0, 0.7, 1], [1, 0.6, 0], Extrapolation.CLAMP),
      borderBottomLeftRadius: interpolate(progress, [0, 0.3], [0, 20], Extrapolation.CLAMP),
      borderBottomRightRadius: interpolate(progress, [0, 0.3], [0, 20], Extrapolation.CLAMP),
    };
  });

  useEffect(() => {
    RNAnimated.timing(contentOpacity, {
      toValue: 1,
      duration: 800,
      delay: 200,
      useNativeDriver: true,
    }).start();

    RNAnimated.timing(bottomOpacity, {
      toValue: 1,
      duration: 600,
      delay: 600,
      useNativeDriver: true,
    }).start();

    const bounce = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(chevronAnim, { toValue: -5, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(chevronAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    bounce.start();
    return () => bounce.stop();
  }, [contentOpacity, bottomOpacity, chevronAnim]);

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View style={[styles.overlay, curtainStyle]}>
        <StarField>
          <View style={styles.content} pointerEvents="box-none">
            {/* Branding — centered */}
            <RNAnimated.View style={[styles.center, { opacity: contentOpacity }]} pointerEvents="box-none">
              <Text style={styles.logo}>PNL</Text>
              <View style={styles.divider} />
              <Text style={styles.subtitle}>PREDICT AND LAUNCH</Text>
            </RNAnimated.View>

            {/* Bottom */}
            <RNAnimated.View style={[styles.bottom, { opacity: bottomOpacity }]} pointerEvents="box-none">
              <PressableScale style={styles.signInButton} onPress={onSignIn}>
                <Text style={styles.signInText}>Sign In</Text>
              </PressableScale>

              <RNAnimated.View style={[styles.hintRow, { transform: [{ translateY: chevronAnim }] }]}>
                <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.25)" />
              </RNAnimated.View>
            </RNAnimated.View>
          </View>
        </StarField>
      </Reanimated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: WINDOW_HEIGHT,
    zIndex: 100,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 72,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 16,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 6,
  },
  bottom: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
    gap: 20,
    alignItems: 'center',
  },
  signInButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  hintRow: {
    alignItems: 'center',
  },
});
