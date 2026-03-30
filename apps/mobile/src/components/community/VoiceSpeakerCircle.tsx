/**
 * VoiceSpeakerCircle — Clubhouse-inspired large speaker circle.
 *
 * - 88px circle with gradient-like color fills
 * - Speaking ring pulses outside the circle
 * - Mute badge sits OUTSIDE on the bottom-right edge
 * - Role badge (crown/star) on top-right edge
 * - Clean name + role label below
 */

import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import { AvatarImage } from '../AvatarImage';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { VoiceParticipant } from '../../providers/VoiceRoomProvider';
import { colors } from '../../theme';

// Clubhouse-inspired palette — vibrant, warm, distinct
const CIRCLE_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f43f5e', // rose/coral
  '#a78bfa', // purple
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#8b5cf6', // violet
] as const;

const CIRCLE_SIZE = 88;
const RING_GAP = 6;
const RING_SIZE = CIRCLE_SIZE + RING_GAP * 2;
const CONTAINER_WIDTH = RING_SIZE + 16;

interface VoiceSpeakerCircleProps {
  participant: VoiceParticipant;
  index: number;
  founderWallet?: string | null;
  coHosts: string[];
  isCurrentUserHost: boolean;
  isCurrentUserFounder: boolean;
  onMute?: (peerId: string) => void;
  onKick?: (peerId: string) => void;
  onApproveHand?: (peerId: string) => void;
  onPromote?: (peerId: string) => void;
  onDemote?: (peerId: string) => void;
  onAddCoHost?: (peerId: string) => void;
  onRemoveCoHost?: (peerId: string) => void;
}

export function VoiceSpeakerCircle({
  participant,
  index,
  founderWallet,
  coHosts,
  isCurrentUserHost,
  isCurrentUserFounder,
  onMute,
  onKick,
  onApproveHand,
  onPromote,
  onDemote,
  onAddCoHost,
  onRemoveCoHost,
}: VoiceSpeakerCircleProps) {
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  const isSelf = participant.displayName === 'You';
  const isFounder = participant.peerId === founderWallet;
  const isCoHost = coHosts.includes(participant.peerId);
  const displayName = participant.displayName || participant.peerId.slice(0, 6) + '...';
  const initials = isSelf ? 'ME' : displayName.slice(0, 2).toUpperCase();
  const circleColor = CIRCLE_COLORS[index % CIRCLE_COLORS.length];

  // Speaking animation — smooth pulse
  useEffect(() => {
    if (participant.isSpeaking) {
      ringOpacity.value = withTiming(1, { duration: 200 });
      ringScale.value = withRepeat(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      ringOpacity.value = withTiming(0, { duration: 400 });
      ringScale.value = withTiming(1, { duration: 300 });
    }
  }, [participant.isSpeaking, ringScale, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const handleLongPress = useCallback(() => {
    if (!isCurrentUserHost || isSelf) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options: string[] = [];
    const actions: (() => void)[] = [];

    if (participant.hasRaisedHand && onApproveHand) {
      options.push('Approve Hand');
      actions.push(() => onApproveHand(participant.peerId));
    }
    if (onMute) {
      options.push('Mute');
      actions.push(() => onMute(participant.peerId));
    }
    if (isCurrentUserFounder && !isCoHost && onAddCoHost) {
      options.push('Make Co-host');
      actions.push(() => onAddCoHost(participant.peerId));
    }
    if (isCurrentUserFounder && isCoHost && onRemoveCoHost) {
      options.push('Remove Co-host');
      actions.push(() => onRemoveCoHost(participant.peerId));
    }
    if (participant.isSpeaker && onDemote) {
      options.push('Move to Listeners');
      actions.push(() => onDemote(participant.peerId));
    }
    if (!participant.isSpeaker && onPromote) {
      options.push('Promote to Speaker');
      actions.push(() => onPromote(participant.peerId));
    }
    if (onKick) {
      options.push('Remove from Room');
      actions.push(() => {
        Alert.alert('Remove User', `Remove ${displayName}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => onKick(participant.peerId) },
        ]);
      });
    }
    options.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: options.indexOf('Remove from Room') },
        (idx) => { if (idx < actions.length) actions[idx](); },
      );
    } else {
      Alert.alert(displayName, 'Host Actions', [
        ...actions.map((action, i) => ({
          text: options[i],
          onPress: action,
          ...(options[i] === 'Remove from Room' ? { style: 'destructive' as const } : {}),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [
    isCurrentUserHost, isCurrentUserFounder, isSelf, participant, displayName, isCoHost,
    onMute, onKick, onApproveHand, onPromote, onDemote, onAddCoHost, onRemoveCoHost,
  ]);

  const getRoleLabel = () => {
    if (isFounder) return 'Founder 🔧';
    if (isCoHost) return 'Co-host';
    return 'Speaker';
  };

  return (
    <Pressable onLongPress={handleLongPress} style={styles.container}>
      {/* Speaking ring — pulses OUTSIDE the circle */}
      <Animated.View
        style={[
          styles.speakingRing,
          { borderColor: circleColor },
          ringStyle,
        ]}
      />

      {/* Idle ring — subtle border always visible */}
      <View style={[styles.idleRing, { borderColor: `${circleColor}30` }]} />

      {/* Main avatar circle */}
      <View style={[styles.circle, { backgroundColor: circleColor }]}>
        {participant.profilePhotoUrl ? (
          <AvatarImage uri={participant.profilePhotoUrl} size={CIRCLE_SIZE} />
        ) : (
          <Text style={styles.initials}>{initials}</Text>
        )}
      </View>

      {/* Mute badge — OUTSIDE the circle, bottom-right edge */}
      {participant.isMuted && (
        <View style={styles.muteBadge}>
          <Ionicons name="mic-off" size={11} color="#fff" />
        </View>
      )}

      {/* Role badge — top-right edge */}
      {isFounder && (
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(245,158,11,0.25)' }]}>
          <Text style={styles.roleBadgeEmoji}>👑</Text>
        </View>
      )}
      {isCoHost && !isFounder && (
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(167,139,250,0.25)' }]}>
          <Text style={styles.roleBadgeEmoji}>⭐</Text>
        </View>
      )}

      {/* Raised hand — top-left edge */}
      {participant.hasRaisedHand && (
        <View style={styles.handBadge}>
          <Text style={styles.handEmoji}>✋</Text>
        </View>
      )}

      {/* Name */}
      <Text style={[styles.name, isSelf && styles.nameSelf]} numberOfLines={1}>
        {isSelf ? 'You' : displayName}
      </Text>

      {/* Role label */}
      <Text style={styles.roleLabel}>{getRoleLabel()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: CONTAINER_WIDTH,
    gap: 5,
  },

  // Speaking ring — animated, outside the circle
  speakingRing: {
    position: 'absolute',
    top: 0,
    left: (CONTAINER_WIDTH - RING_SIZE) / 2,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
  },

  // Idle ring — always visible, subtle
  idleRing: {
    position: 'absolute',
    top: 0,
    left: (CONTAINER_WIDTH - RING_SIZE) / 2,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },

  // Main circle — large, bold
  circle: {
    marginTop: RING_GAP,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Subtle inner shadow feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  initials: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },

  // Mute badge — positioned OUTSIDE at bottom-right edge of the circle
  muteBadge: {
    position: 'absolute',
    bottom: 28, // above the name text
    right: (CONTAINER_WIDTH - RING_SIZE) / 2 - 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.background,
    // Glow
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },

  // Role badge — top-right edge
  roleBadge: {
    position: 'absolute',
    top: 0,
    right: (CONTAINER_WIDTH - RING_SIZE) / 2 - 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  roleBadgeEmoji: {
    fontSize: 12,
  },

  // Raised hand — top-left edge
  handBadge: {
    position: 'absolute',
    top: 0,
    left: (CONTAINER_WIDTH - RING_SIZE) / 2 - 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  handEmoji: {
    fontSize: 12,
  },

  name: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    width: '100%',
  },
  nameSelf: {
    color: '#fff',
    fontWeight: '700',
  },
  roleLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
