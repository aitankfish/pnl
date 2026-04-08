import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

const STEP_LABELS = ['Info', 'Token', 'Pitch', 'Links', 'Review'];

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {STEP_LABELS.map((label, i) => {
        const isActive = i === currentStep;
        const isComplete = i < currentStep;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.dot,
                isActive && styles.dotActive,
                isComplete && styles.dotComplete,
              ]}
            />
            <Text
              style={[
                styles.label,
                (isActive || isComplete) && styles.labelActive,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
      {/* Connecting lines */}
      <View style={styles.lineContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.line, i < currentStep && styles.lineComplete]}
          />
        ))}
      </View>
    </View>
  );
}

const DOT_SIZE = 10;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  stepItem: {
    alignItems: 'center',
    zIndex: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.border,
    marginBottom: 6,
  },
  dotActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  dotComplete: {
    backgroundColor: colors.success,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  lineContainer: {
    position: 'absolute',
    top: spacing.md + DOT_SIZE / 2 - 1,
    left: spacing.xl + DOT_SIZE / 2,
    right: spacing.xl + DOT_SIZE / 2,
    flexDirection: 'row',
    zIndex: 0,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  lineComplete: {
    backgroundColor: colors.success,
  },
});
