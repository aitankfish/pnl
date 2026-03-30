/**
 * VoiceRoomVoteButtons — YES/NO vote buttons inside the voice room.
 * Teal YES + Coral NO matching the pitch deck design.
 */

import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '../PressableScale';
import { colors, spacing, borderRadius } from '../../theme';

interface VoiceRoomVoteButtonsProps {
  onVoteYes: () => void;
  onVoteNo: () => void;
  isVoting: boolean;
  votingDirection?: 'yes' | 'no' | null;
  hasPosition?: boolean;
  positionSide?: 'yes' | 'no' | null;
  disabled?: boolean;
}

export function VoiceRoomVoteButtons({
  onVoteYes,
  onVoteNo,
  isVoting,
  votingDirection,
  hasPosition,
  positionSide,
  disabled,
}: VoiceRoomVoteButtonsProps) {
  const handleYes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVoteYes();
  };

  const handleNo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVoteNo();
  };

  const yesDisabled = disabled || (isVoting && votingDirection === 'no') || (hasPosition && positionSide === 'no');
  const noDisabled = disabled || (isVoting && votingDirection === 'yes') || (hasPosition && positionSide === 'yes');

  return (
    <View style={styles.container}>
      {/* YES button */}
      <PressableScale
        onPress={handleYes}
        disabled={yesDisabled}
        style={[
          styles.button,
          styles.yesButton,
          yesDisabled && styles.buttonDisabled,
          hasPosition && positionSide === 'yes' && styles.yesButtonActive,
        ]}
      >
        {isVoting && votingDirection === 'yes' ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="trending-up" size={18} color="#fff" />
            <Text style={styles.buttonText}>YES</Text>
          </>
        )}
      </PressableScale>

      {/* NO button */}
      <PressableScale
        onPress={handleNo}
        disabled={noDisabled}
        style={[
          styles.button,
          styles.noButton,
          noDisabled && styles.buttonDisabled,
          hasPosition && positionSide === 'no' && styles.noButtonActive,
        ]}
      >
        {isVoting && votingDirection === 'no' ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="trending-down" size={18} color="#fff" />
            <Text style={styles.buttonText}>NO</Text>
          </>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
  },
  yesButton: {
    backgroundColor: '#10b981',
  },
  noButton: {
    backgroundColor: '#f43f5e',
  },
  yesButtonActive: {
    backgroundColor: '#059669',
    borderWidth: 2,
    borderColor: '#34d399',
  },
  noButtonActive: {
    backgroundColor: '#e11d48',
    borderWidth: 2,
    borderColor: '#fb7185',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
});
