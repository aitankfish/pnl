import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import type { SubmissionStep } from '../../hooks/useCreateMarket';

const STEPS: Array<{ key: SubmissionStep; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'uploading', label: 'Uploading project data...', icon: 'cloud-upload-outline' },
  { key: 'preparing', label: 'Preparing transaction...', icon: 'construct-outline' },
  { key: 'signing', label: 'Sign with wallet...', icon: 'key-outline' },
  { key: 'confirming', label: 'Confirming on-chain...', icon: 'checkmark-circle-outline' },
  { key: 'completing', label: 'Finalizing market...', icon: 'rocket-outline' },
];

const STEP_INDEX: Record<string, number> = {
  uploading: 0,
  preparing: 1,
  signing: 2,
  confirming: 3,
  completing: 4,
};

interface SubmissionOverlayProps {
  step: SubmissionStep;
  visible: boolean;
}

export function SubmissionOverlay({ step, visible }: SubmissionOverlayProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const activeIndex = STEP_INDEX[step] ?? -1;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Creating Market</Text>
          <Text style={styles.subtitle}>Please don't close the app</Text>

          <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
            <Ionicons name="sync-outline" size={36} color={colors.primary} />
          </Animated.View>

          <View style={styles.stepsContainer}>
            {STEPS.map((s, i) => {
              const isActive = i === activeIndex;
              const isComplete = i < activeIndex;
              const isPending = i > activeIndex;
              return (
                <View key={s.key} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepDot,
                      isComplete && styles.stepDotComplete,
                      isActive && styles.stepDotActive,
                    ]}
                  >
                    {isComplete ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Ionicons
                        name={s.icon}
                        size={12}
                        color={isActive ? '#fff' : colors.textMuted}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isActive && styles.stepLabelActive,
                      isPending && styles.stepLabelPending,
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  stepsContainer: {
    width: '100%',
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDotComplete: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  stepLabelActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  stepLabelPending: {
    color: colors.textMuted,
  },
});
