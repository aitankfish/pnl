import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, ViewStyle, Platform } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';

interface OTPInputProps {
  length?: number;
  onComplete: (code: string) => void;
  style?: ViewStyle;
}

export function OTPInput({ length = 6, onComplete, style }: OTPInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    // Handle paste of full code
    if (text.length === length) {
      const chars = text.split('').slice(0, length);
      setValues(chars);
      inputs.current[length - 1]?.focus();
      onComplete(chars.join(''));
      return;
    }

    const char = text.slice(-1);
    const next = [...values];
    next[index] = char;
    setValues(next);

    if (char && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    const code = next.join('');
    if (code.length === length && next.every(v => v)) {
      onComplete(code);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) {
      const next = [...values];
      next[index - 1] = '';
      setValues(next);
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {values.map((val, i) => (
        <TextInput
          key={i}
          ref={r => { inputs.current[i] = r; }}
          value={val}
          onChangeText={text => handleChange(text, i)}
          onKeyPress={e => handleKeyPress(e, i)}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex((prev) => (prev === i ? null : prev))}
          style={[
            styles.box,
            val ? styles.filled : null,
            focusedIndex === i && styles.active,
          ]}
          keyboardType="number-pad"
          maxLength={i === 0 ? length : 1}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          selectionColor={colors.primary}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  filled: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
  },
  active: {
    borderColor: colors.primary,
    ...(Platform.OS === 'ios' && {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 8,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 4,
    }),
  },
});
