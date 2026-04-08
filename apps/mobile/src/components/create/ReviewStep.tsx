import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '../PressableScale';
import { colors, spacing, borderRadius, typography } from '../../theme';
import type { CreateMarketForm, ProjectImage, VideoFile, SocialLinks } from '../../hooks/useCreateMarket';

const MAX_GALLERY_TOTAL = 4;

const DURATION_LABELS: Record<string, string> = {
  '1': '1 Day',
  '3': '3 Days',
  '7': '1 Week',
  '14': '2 Weeks',
  '30': '1 Month',
  '60': '2 Months',
  '90': '3 Months',
  '180': '6 Months',
};

interface ReviewStepProps {
  form: CreateMarketForm;
  projectImage: ProjectImage | null;
  galleryImages: ProjectImage[];
  pitchVideo: VideoFile | null;
  isSubmitting: boolean;
  onSubmit: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SocialRow({ links }: { links: SocialLinks }) {
  const filled = Object.entries(links).filter(([, v]) => v.trim());
  if (filled.length === 0) return <Text style={styles.noneText}>None added</Text>;
  return (
    <View style={styles.socialList}>
      {filled.map(([key, url]) => (
        <View key={key} style={styles.socialItem}>
          <Text style={styles.socialKey}>{key}</Text>
          <Text style={styles.socialUrl} numberOfLines={1}>
            {url}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ReviewStep({ form, projectImage, galleryImages, pitchVideo, isSubmitting, onSubmit }: ReviewStepProps) {
  const totalImages = (projectImage ? 1 : 0) + galleryImages.length;
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Review & Launch</Text>
      <Text style={styles.stepSubtitle}>Confirm everything looks right</Text>

      {/* Project card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {projectImage ? (
            <Image source={{ uri: projectImage.uri }} style={styles.projectImage} />
          ) : (
            <View style={[styles.projectImage, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={24} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.cardHeaderText}>
            <Text style={styles.projectName}>{form.name || 'Untitled'}</Text>
            <Text style={styles.tokenSymbol}>${form.tokenSymbol || '???'}</Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={4}>
          {form.description || 'No description'}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Basic Info</Text>
        <InfoRow label="Category" value={form.category || '—'} />
        <InfoRow label="Type" value={form.projectType || '—'} />
        <InfoRow label="Stage" value={form.projectStage || '—'} />
        <InfoRow label="Team Size" value={form.teamSize || '—'} />
        {form.location ? <InfoRow label="Location" value={form.location} /> : null}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Market Config</Text>
        <InfoRow label="Target Pool" value={form.targetPool ? `${form.targetPool} SOL` : '—'} />
        <InfoRow
          label="Duration"
          value={form.marketDuration ? (DURATION_LABELS[form.marketDuration] || `${form.marketDuration} days`) : '—'}
        />

        {galleryImages.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Gallery ({galleryImages.length} image{galleryImages.length !== 1 ? 's' : ''})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryRow}>
              {galleryImages.map((img, i) => (
                <Image key={i} source={{ uri: img.uri }} style={styles.galleryThumb} />
              ))}
            </ScrollView>
          </>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Pitch Video</Text>
        {pitchVideo ? (
          <View style={styles.videoPreviewRow}>
            <View style={styles.videoThumb}>
              <Ionicons name="videocam" size={20} color={colors.primary} />
            </View>
            <Text style={styles.infoValue}>Video included</Text>
          </View>
        ) : (
          <InfoRow label="Video" value="None" />
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Social Links</Text>
        <SocialRow links={form.socialLinks} />

        {form.additionalNotes ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{form.additionalNotes}</Text>
          </>
        ) : null}
      </View>

      {/* Fee breakdown */}
      <View style={styles.feeCard}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Creation Fee</Text>
          <Text style={styles.feeValue}>0.015 SOL</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Network</Text>
          <Text style={styles.feeValue}>~0.001 SOL</Text>
        </View>
        <View style={[styles.feeRow, styles.feeTotalRow]}>
          <Text style={styles.feeTotalLabel}>Total</Text>
          <Text style={styles.feeTotalValue}>~0.016 SOL</Text>
        </View>
      </View>

      {/* Submit button */}
      <PressableScale onPress={onSubmit} disabled={isSubmitting} style={styles.submitButton}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.submitGradient}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>Launch Prediction Market</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing['2xl'] },
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
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  projectImage: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
  },
  placeholderImage: {
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderText: {
    flex: 1,
  },
  projectName: {
    ...typography.title,
    color: colors.textPrimary,
  },
  tokenSymbol: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    maxWidth: '55%',
    textAlign: 'right',
  },
  noneText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  socialList: {
    gap: 4,
  },
  socialItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  socialKey: {
    ...typography.micro,
    color: colors.textMuted,
    width: 60,
    textTransform: 'capitalize',
  },
  socialUrl: {
    ...typography.micro,
    color: colors.primary,
    flex: 1,
  },
  notesText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  galleryRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  galleryThumb: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  videoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  videoThumb: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  feeValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  feeTotalRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 0,
  },
  feeTotalLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  feeTotalValue: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
