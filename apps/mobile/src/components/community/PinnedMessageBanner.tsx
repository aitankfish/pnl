import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IChatMessage } from '@pnl/shared/hooks';
import { colors, spacing, typography, borderRadius, editorial } from '../../theme';

interface PinnedMessageBannerProps {
  messages: IChatMessage[];
  isFounder: boolean;
  onUnpin: (messageId: string) => void;
}

/**
 * PinnedMessageBanner — editorial pull-quote at the top of chat.
 *
 * Replaces the previous yellow-alert treatment. Now reads as a header
 * card with an amber side-rule and italic Fraunces caption ("Pinned by
 * the founder"). Tap to expand the stack of all pinned messages; tap
 * the chevron again to collapse.
 *
 * Visual hierarchy: amber rule = founder's voice; subdued type weight
 * keeps the chat stream the focus.
 */
export function PinnedMessageBanner({ messages, isFounder, onUnpin }: PinnedMessageBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  const visibleMessages = expanded ? messages : [messages[0]];
  const extra = messages.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.rule} />
      <View style={styles.body}>
        <Pressable
          onPress={() => (messages.length > 1 ? setExpanded(!expanded) : null)}
          style={styles.header}
          hitSlop={6}
        >
          <Text style={styles.headerLabel}>
            Pinned by the founder
          </Text>
          {messages.length > 1 && (
            <View style={styles.headerRight}>
              {!expanded && extra > 0 && (
                <Text style={styles.extraCount}>+{extra}</Text>
              )}
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={colors.textMuted}
              />
            </View>
          )}
        </Pressable>

        {visibleMessages.map((msg) => (
          <View key={msg._id} style={styles.message}>
            <View style={styles.messageContent}>
              <Text style={styles.messageText} numberOfLines={expanded ? undefined : 3}>
                {msg.message}
              </Text>
              <Text style={styles.author}>
                — {msg.displayName || msg.walletAddress.slice(0, 6) + '…'}
              </Text>
            </View>
            {isFounder && (
              <Pressable onPress={() => onUnpin(msg._id)} hitSlop={8} style={styles.unpinBtn}>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(232, 150, 96, 0.04)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  rule: {
    width: 3,
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLabel: {
    ...editorial.section,
    color: colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  extraCount: {
    ...typography.micro,
    color: colors.textMuted,
    fontWeight: '600',
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    ...typography.caption,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  author: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 4,
  },
  unpinBtn: {
    padding: 2,
  },
});
