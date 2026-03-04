import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { VoiceParticipant } from '../../providers/VoiceRoomProvider';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface VoiceSpeakerAvatarProps {
  participant: VoiceParticipant;
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

export function VoiceSpeakerAvatar({
  participant,
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
}: VoiceSpeakerAvatarProps) {
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  const isSelf = participant.displayName === 'You';
  const isFounder = participant.peerId === founderWallet;
  const isCoHost = coHosts.includes(participant.peerId);
  const displayName = participant.displayName || participant.peerId.slice(0, 6) + '...';
  const initials = isSelf ? 'ME' : displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (participant.isSpeaking) {
      ringOpacity.value = withTiming(1, { duration: 200 });
      ringScale.value = withRepeat(
        withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      ringOpacity.value = withTiming(0, { duration: 300 });
      ringScale.value = withTiming(1, { duration: 200 });
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
      Alert.alert(
        displayName,
        'Host Actions',
        [
          ...actions.map((action, i) => ({
            text: options[i],
            onPress: action,
            ...(options[i] === 'Remove from Room' ? { style: 'destructive' as const } : {}),
          })),
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  }, [
    isCurrentUserHost, isCurrentUserFounder, isSelf, participant, displayName, isCoHost,
    onMute, onKick, onApproveHand, onPromote, onDemote, onAddCoHost, onRemoveCoHost,
  ]);

  const getBorderColor = () => {
    if (isSelf) return '#818cf8'; // cyan-purple like web
    if (isFounder) return colors.warning;
    if (isCoHost) return colors.accent;
    return colors.border;
  };

  return (
    <Pressable onLongPress={handleLongPress} style={styles.container}>
      {/* Speaking ring */}
      <Animated.View style={[styles.speakingRing, ringStyle]} />

      {/* Avatar */}
      <View style={[styles.avatar, { borderColor: getBorderColor() }]}>
        {participant.profilePhotoUrl ? (
          <Image source={{ uri: participant.profilePhotoUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.initials}>{initials}</Text>
        )}

        {/* Mute indicator */}
        {participant.isMuted && (
          <View style={styles.muteIndicator}>
            <Ionicons name="mic-off" size={10} color="#fff" />
          </View>
        )}
      </View>

      {/* Role badges */}
      {isFounder && (
        <View style={[styles.roleBadge, { backgroundColor: colors.warningLight }]}>
          <Text style={styles.roleBadgeText}>👑</Text>
        </View>
      )}
      {isCoHost && !isFounder && (
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(167,139,250,0.2)' }]}>
          <Text style={styles.roleBadgeText}>⭐</Text>
        </View>
      )}

      {/* Raised hand */}
      {participant.hasRaisedHand && (
        <View style={styles.handBadge}>
          <Text style={styles.handEmoji}>✋</Text>
        </View>
      )}

      {/* Name */}
      <Text style={[styles.name, isSelf && styles.nameSelf]} numberOfLines={1}>
        {displayName}
      </Text>

      {/* Role label */}
      {(isFounder || isCoHost) && (
        <Text style={styles.roleLabel}>
          {isFounder ? 'Host' : 'Co-host'}
        </Text>
      )}
    </Pressable>
  );
}

const AVATAR_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 76,
    gap: 4,
  },
  speakingRing: {
    position: 'absolute',
    top: -3,
    left: (76 - (AVATAR_SIZE + 6)) / 2, // center within 76px container
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    borderWidth: 2,
    borderColor: colors.success,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initials: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  muteIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    position: 'absolute',
    top: -4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: {
    fontSize: 10,
  },
  handBadge: {
    position: 'absolute',
    top: -4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handEmoji: {
    fontSize: 10,
  },
  name: {
    ...typography.micro,
    color: colors.textSecondary,
    textAlign: 'center',
    width: '100%',
  },
  nameSelf: {
    color: '#fff',
    fontWeight: '600',
  },
  roleLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
