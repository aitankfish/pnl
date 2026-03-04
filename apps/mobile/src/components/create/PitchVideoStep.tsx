import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../PressableScale';
import { useVideoPicker, type VideoResult } from '../../hooks/useVideoPicker';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface PitchVideoStepProps {
  pitchVideo: VideoResult | null;
  setPitchVideo: (uri: string, name: string, type: string) => void;
  clearPitchVideo: () => void;
}

export function PitchVideoStep({
  pitchVideo,
  setPitchVideo,
  clearPitchVideo,
}: PitchVideoStepProps) {
  const { pickVideo, recordVideo } = useVideoPicker();
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const handleRecord = async () => {
    const result = await recordVideo();
    if (result) setPitchVideo(result.uri, result.name, result.type);
  };

  const handlePick = async () => {
    const result = await pickVideo();
    if (result) setPitchVideo(result.uri, result.name, result.type);
  };

  const togglePlayback = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Pitch Video</Text>
      <Text style={styles.stepSubtitle}>
        Record a 1–2 minute pitch video (optional)
      </Text>

      {pitchVideo ? (
        /* ── Preview State ──────────────────────────────────── */
        <View style={styles.previewContainer}>
          <PressableScale onPress={togglePlayback} style={styles.videoWrapper}>
            <Video
              ref={videoRef}
              source={{ uri: pitchVideo.uri }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
              isMuted={false}
            />
            {!isPlaying && (
              <View style={styles.playOverlay}>
                <Ionicons name="play" size={48} color="rgba(255,255,255,0.9)" />
              </View>
            )}
          </PressableScale>

          <View style={styles.previewActions}>
            <PressableScale onPress={clearPitchVideo} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Remove</Text>
            </PressableScale>

            <PressableScale onPress={handlePick} style={styles.actionButton}>
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>Replace</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        /* ── Empty State ────────────────────────────────────── */
        <View style={styles.cardsRow}>
          <PressableScale onPress={handleRecord} style={styles.actionCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="videocam-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Record Pitch</Text>
            <Text style={styles.cardCaption}>Front-facing camera, up to 2 min</Text>
          </PressableScale>

          <PressableScale onPress={handlePick} style={styles.actionCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="folder-open-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Upload Video</Text>
            <Text style={styles.cardCaption}>Choose from your library</Text>
          </PressableScale>
        </View>
      )}

      <Text style={styles.hint}>
        Skip — you can add a video later from your market page.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  stepTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  stepSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  /* ── Action Cards (empty state) ─── */
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cardCaption: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'center',
  },
  /* ── Preview ─────────────────────── */
  previewContainer: {
    marginBottom: spacing.lg,
  },
  videoWrapper: {
    aspectRatio: 9 / 16,
    maxHeight: 400,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    ...typography.captionBold,
  },
  /* ── Hint ─────────────────────────── */
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
