import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IChatMessage } from '@pnl/shared/hooks/useChat';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface PinnedMessageBannerProps {
  messages: IChatMessage[];
  isFounder: boolean;
  onUnpin: (messageId: string) => void;
}

export function PinnedMessageBanner({ messages, isFounder, onUnpin }: PinnedMessageBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  const visibleMessages = expanded ? messages : [messages[0]];

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <Ionicons name="pin" size={14} color={colors.warning} />
        <Text style={styles.headerText}>
          {messages.length} pinned message{messages.length !== 1 ? 's' : ''}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      </Pressable>

      {visibleMessages.map((msg) => (
        <View key={msg._id} style={styles.message}>
          <View style={styles.messageContent}>
            <Text style={styles.author}>
              {msg.displayName || msg.walletAddress.slice(0, 6) + '...'}
            </Text>
            <Text style={styles.messageText} numberOfLines={2}>
              {msg.message}
            </Text>
          </View>
          {isFounder && (
            <Pressable onPress={() => onUnpin(msg._id)} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerText: {
    ...typography.micro,
    color: colors.warning,
    flex: 1,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  messageContent: {
    flex: 1,
  },
  author: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});
