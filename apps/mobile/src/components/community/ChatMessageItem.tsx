import { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { IChatMessage } from '@pnl/shared/hooks/useChat';
import { colors, spacing, typography, borderRadius } from '../../theme';

const REACTION_EMOJIS = ['🚀', '💎', '🔥', '👀', '❤️'] as const;

interface ChatMessageItemProps {
  message: IChatMessage;
  isOwn: boolean;
  isFounder: boolean;
  founderWallet?: string | null;
  isConsecutive: boolean;
  canReply: boolean;
  onReply: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string, pinned: boolean) => void;
  replyMessage?: IChatMessage | null;
}

function getPositionBadge(wallet: string, founderWallet?: string | null): { label: string; color: string; bg: string } | null {
  if (founderWallet && wallet === founderWallet) {
    return { label: 'Founder', color: colors.warning, bg: 'rgba(245, 158, 11, 0.15)' };
  }
  return null;
}

function formatTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ChatMessageItem({
  message,
  isOwn,
  isFounder,
  founderWallet,
  isConsecutive,
  canReply,
  onReply,
  onReact,
  onDelete,
  onPin,
  replyMessage,
}: ChatMessageItemProps) {
  const badge = getPositionBadge(message.walletAddress, founderWallet);
  const displayName = message.displayName || message.walletAddress.slice(0, 6) + '...';

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options: string[] = [];
    const actions: (() => void)[] = [];

    // Reactions
    REACTION_EMOJIS.forEach((emoji) => {
      options.push(`React ${emoji}`);
      actions.push(() => onReact(message._id, emoji));
    });

    if (canReply) {
      options.push('Reply');
      actions.push(() => onReply(message._id));
    }

    if (isOwn || isFounder) {
      options.push('Delete');
      actions.push(() => {
        Alert.alert('Delete Message', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(message._id) },
        ]);
      });
    }

    if (isFounder) {
      const pinLabel = message.isPinned ? 'Unpin' : 'Pin';
      options.push(pinLabel);
      actions.push(() => onPin(message._id, !message.isPinned));
    }

    options.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: options.indexOf('Delete') },
        (idx) => { if (idx < actions.length) actions[idx](); },
      );
    } else {
      // Android fallback — simple Alert with first few actions
      Alert.alert(
        'Message Actions',
        undefined,
        [
          ...(canReply ? [{ text: 'Reply', onPress: () => onReply(message._id) }] : []),
          ...(isOwn || isFounder
            ? [{ text: 'Delete', style: 'destructive' as const, onPress: () => onDelete(message._id) }]
            : []),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
    }
  }, [message, isOwn, isFounder, canReply, onReply, onReact, onDelete, onPin]);

  const reactions = message.reactions
    ? Object.entries(message.reactions).filter(([, count]) => count > 0)
    : [];

  return (
    <Pressable onLongPress={handleLongPress} style={[styles.container, isConsecutive && styles.consecutive]}>
      {/* Reply preview */}
      {replyMessage && (
        <View style={styles.replyPreview}>
          <View style={styles.replyBar} />
          <Text style={styles.replyText} numberOfLines={1}>
            {replyMessage.displayName || replyMessage.walletAddress.slice(0, 6) + '...'}: {replyMessage.message}
          </Text>
        </View>
      )}

      {/* Header (hidden for consecutive) */}
      {!isConsecutive && (
        <View style={styles.header}>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          )}
          <Text style={[styles.displayName, badge && { color: badge.color }]}>
            {displayName}
          </Text>
          <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
        </View>
      )}

      {/* Message body */}
      <Text style={styles.messageText}>{message.message}</Text>

      {/* Reactions row */}
      {reactions.length > 0 && (
        <View style={styles.reactions}>
          {reactions.map(([emoji, count]) => (
            <Pressable
              key={emoji}
              onPress={() => onReact(message._id, emoji)}
              style={styles.reactionPill}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={styles.reactionCount}>{count}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  consecutive: {
    paddingTop: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    ...typography.micro,
    fontSize: 10,
    fontWeight: '700',
  },
  displayName: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  time: {
    ...typography.micro,
    color: colors.textMuted,
  },
  messageText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  replyBar: {
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
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 11,
  },
});
