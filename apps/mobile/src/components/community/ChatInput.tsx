import { useState, useCallback, useRef } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius } from '../../theme';

const MAX_CHARS = 500;

interface ChatInputProps {
  walletAddress?: string | null;
  hasPosition: boolean;
  isFounder: boolean;
  replyToMessage?: { _id: string; displayName?: string; message: string } | null;
  onSend: (message: string, replyTo?: string) => Promise<{ success: boolean; error?: string }>;
  onTyping: (displayName?: string) => void;
  onCancelReply: () => void;
  error?: string | null;
}

export function ChatInput({
  walletAddress,
  hasPosition,
  isFounder,
  replyToMessage,
  onSend,
  onTyping,
  onCancelReply,
  error,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const canChat = hasPosition || isFounder;

  const handleChangeText = useCallback(
    (value: string) => {
      if (value.length <= MAX_CHARS) {
        setText(value);
        setLocalError(null);
      }
      // Debounce typing indicator
      if (!typingDebounceRef.current) {
        onTyping();
        typingDebounceRef.current = setTimeout(() => {
          typingDebounceRef.current = null;
        }, 2000);
      }
    },
    [onTyping],
  );

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await onSend(trimmed, replyToMessage?._id);

    if (result.success) {
      setText('');
      onCancelReply();
    } else {
      setLocalError(result.error || 'Failed to send');
    }
    setSending(false);
  }, [text, sending, onSend, replyToMessage, onCancelReply]);

  if (!walletAddress) {
    return (
      <View style={styles.lockedContainer}>
        <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
        <Text style={styles.lockedText}>Sign in to join the conversation</Text>
      </View>
    );
  }

  if (!canChat) {
    return (
      <View style={styles.lockedContainer}>
        <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
        <Text style={styles.lockedText}>Vote YES or NO to unlock chat</Text>
      </View>
    );
  }

  const showCounter = text.length > 400;
  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* Reply bar */}
        {replyToMessage && (
          <View style={styles.replyBar}>
            <View style={styles.replyIndicator} />
            <Text style={styles.replyText} numberOfLines={1}>
              Replying to{' '}
              <Text style={styles.replyAuthor}>
                {replyToMessage.displayName || 'user'}
              </Text>
              : {replyToMessage.message}
            </Text>
            <Pressable onPress={onCancelReply} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Error */}
        {displayError && (
          <Text style={styles.errorText}>{displayError}</Text>
        )}

        {/* Input row */}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={handleChangeText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={MAX_CHARS}
            editable={!sending}
            returnKeyType="default"
          />
          <View style={styles.rightControls}>
            {showCounter && (
              <Text style={[styles.charCount, text.length >= MAX_CHARS && styles.charCountMax]}>
                {text.length}/{MAX_CHARS}
              </Text>
            )}
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
            >
              <Ionicons
                name="send"
                size={18}
                color={text.trim() && !sending ? colors.primary : colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  lockedText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  replyIndicator: {
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  replyText: {
    ...typography.micro,
    color: colors.textMuted,
    flex: 1,
  },
  replyAuthor: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  errorText: {
    ...typography.micro,
    color: colors.danger,
    paddingBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.caption,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rightControls: {
    alignItems: 'center',
    gap: 2,
  },
  charCount: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 10,
  },
  charCountMax: {
    color: colors.danger,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(129,140,248,0.1)',
  },
  sendButtonDisabled: {
    backgroundColor: 'transparent',
  },
});
