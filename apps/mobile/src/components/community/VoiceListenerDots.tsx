/**
 * VoiceListenerDots — Clubhouse-style listener section.
 *
 * Shows "LISTENERS" label with small avatar dots.
 * When empty, shows nothing. When few, centers them.
 * Includes a subtle "+" dot for the join-feel.
 */

import { View, Text, StyleSheet } from 'react-native';
import type { VoiceParticipant } from '../../providers/VoiceRoomProvider';
import { colors, spacing } from '../../theme';

interface VoiceListenerDotsProps {
  participants: VoiceParticipant[];
}

const MAX_VISIBLE_DOTS = 8;
const DOT_SIZE = 32;

export function VoiceListenerDots({ participants }: VoiceListenerDotsProps) {
  const listeners = participants.filter((p) => !p.isSpeaker);

  // Always show the section (with empty state) for visual balance
  const visible = listeners.slice(0, MAX_VISIBLE_DOTS);
  const remaining = listeners.length - MAX_VISIBLE_DOTS;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>LISTENERS</Text>
      <View style={styles.dotsRow}>
        {visible.length === 0 ? (
          // Empty state — placeholder dots to keep layout balanced
          <>
            {[0, 1, 2].map((i) => (
              <View key={`empty-${i}`} style={[styles.dot, styles.emptyDot]} />
            ))}
            <View style={[styles.dot, styles.joinDot]}>
              <Text style={styles.joinText}>+</Text>
            </View>
          </>
        ) : (
          <>
            {visible.map((p) => {
              const initial = (p.displayName || p.peerId)[0]?.toUpperCase() || '?';
              return (
                <View key={p.peerId} style={styles.dot}>
                  <Text style={styles.dotText}>{initial}</Text>
                  {p.hasRaisedHand && (
                    <View style={styles.handIndicator}>
                      <Text style={styles.handText}>✋</Text>
                    </View>
                  )}
                </View>
              );
            })}
            {remaining > 0 && (
              <View style={[styles.dot, styles.moreDot]}>
                <Text style={styles.moreText}>+{remaining}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Reaction emojis hint */}
      {listeners.length === 0 && (
        <Text style={styles.emptyHint}>Listeners will appear here</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  emptyDot: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  joinDot: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  joinText: {
    fontSize: 16,
    fontWeight: '300',
    color: colors.textMuted,
  },
  dotText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  moreDot: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  moreText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  handIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  handText: {
    fontSize: 8,
  },
  emptyHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.15)',
    fontStyle: 'italic',
  },
});
