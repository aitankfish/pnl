import { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GorhomBottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../PressableScale';
import { MAX_SPEAKERS } from '../../providers/VoiceRoomProvider';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface VoiceJoinChoiceSheetProps {
  visible: boolean;
  speakerCount: number;
  onJoinAsSpeaker: () => void;
  onJoinAsListener: () => void;
  onCancel: () => void;
}

export function VoiceJoinChoiceSheet({
  visible,
  speakerCount,
  onJoinAsSpeaker,
  onJoinAsListener,
  onCancel,
}: VoiceJoinChoiceSheetProps) {
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const snapPoints = useMemo(() => [280], []);
  const canSpeaker = speakerCount < MAX_SPEAKERS;

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    [],
  );

  if (!visible) return null;

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onCancel}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
    >
      <View style={styles.content}>
        <Text style={styles.title}>How would you like to join?</Text>

        <PressableScale
          onPress={onJoinAsSpeaker}
          disabled={!canSpeaker}
          style={[styles.option, !canSpeaker && styles.optionDisabled]}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="mic" size={24} color={canSpeaker ? colors.success : colors.textMuted} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Join as Speaker</Text>
            <Text style={styles.optionSubtitle}>
              {canSpeaker
                ? `${MAX_SPEAKERS - speakerCount} speaker spot${MAX_SPEAKERS - speakerCount !== 1 ? 's' : ''} available`
                : 'Speaker spots full'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </PressableScale>

        <PressableScale onPress={onJoinAsListener} style={styles.option}>
          <View style={styles.optionIcon}>
            <Ionicons name="headset" size={24} color={colors.primary} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Join as Listener</Text>
            <Text style={styles.optionSubtitle}>Listen and raise hand to speak</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </PressableScale>
      </View>
    </GorhomBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.sheetBackground,
  },
  handle: {
    backgroundColor: colors.sheetHandle,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  optionSubtitle: {
    ...typography.micro,
    color: colors.textMuted,
  },
});
