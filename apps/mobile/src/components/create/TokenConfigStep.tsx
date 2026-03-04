import React from 'react';
import { View, Text, TextInput, Image, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../PressableScale';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import type { CreateMarketForm, FormErrors, ProjectImage } from '../../hooks/useCreateMarket';

const MAX_GALLERY_IMAGES = 3;

const TARGET_POOLS = ['5', '10', '15'];
const DURATION_OPTIONS = [
  { label: '1D', value: '1' },
  { label: '3D', value: '3' },
  { label: '1W', value: '7' },
  { label: '2W', value: '14' },
  { label: '1M', value: '30' },
  { label: '2M', value: '60' },
  { label: '3M', value: '90' },
  { label: '6M', value: '180' },
];

interface TokenConfigStepProps {
  form: CreateMarketForm;
  errors: FormErrors;
  projectImage: ProjectImage | null;
  galleryImages: ProjectImage[];
  updateField: (key: keyof Omit<CreateMarketForm, 'socialLinks'>, value: string) => void;
  setProjectImage: (uri: string, name: string, type: string) => void;
  clearProjectImage: () => void;
  addGalleryImage: (uri: string, name: string, type: string) => void;
  removeGalleryImage: (index: number) => void;
}

export function TokenConfigStep({
  form,
  errors,
  projectImage,
  galleryImages,
  updateField,
  setProjectImage,
  clearProjectImage,
  addGalleryImage,
  removeGalleryImage,
}: TokenConfigStepProps) {
  const { pickPhoto } = usePhotoUpload();
  const isMeme = form.category.toLowerCase() === 'meme';
  const totalImages = (projectImage ? 1 : 0) + galleryImages.length;

  const handlePickImage = async () => {
    const result = await pickPhoto();
    if (result) {
      setProjectImage(result.uri, result.name, result.type);
    }
  };

  const handlePickGalleryImage = async () => {
    const result = await pickPhoto();
    if (result) {
      addGalleryImage(result.uri, result.name, result.type);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Token & Market Config</Text>
      <Text style={styles.stepSubtitle}>Configure your prediction market</Text>

      {/* Token Symbol */}
      <Text style={styles.label}>Token Symbol *</Text>
      <TextInput
        style={[styles.input, errors.tokenSymbol && styles.inputError]}
        value={form.tokenSymbol}
        onChangeText={(v) => updateField('tokenSymbol', v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="e.g. MYTOKEN"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        maxLength={10}
        selectionColor={colors.primary}
      />
      {errors.tokenSymbol && <Text style={styles.error}>{errors.tokenSymbol}</Text>}
      <Text style={styles.counter}>{form.tokenSymbol.length}/10 chars</Text>

      {/* Project Image */}
      <Text style={styles.label}>Project Image *</Text>
      {projectImage ? (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: projectImage.uri }} style={styles.imagePreview} />
          <PressableScale onPress={clearProjectImage} style={styles.removeImage}>
            <Ionicons name="close-circle" size={24} color={colors.danger} />
          </PressableScale>
          <PressableScale onPress={handlePickImage} style={styles.changeImage}>
            <Text style={styles.changeImageText}>Change</Text>
          </PressableScale>
        </View>
      ) : (
        <PressableScale
          onPress={handlePickImage}
          style={[styles.imagePicker, errors.projectImage && styles.inputError]}
        >
          <Ionicons name="image-outline" size={32} color={colors.textMuted} />
          <Text style={styles.imagePickerText}>Tap to select image</Text>
          <Text style={styles.imagePickerHint}>Square, 1:1 ratio recommended</Text>
        </PressableScale>
      )}
      {errors.projectImage && <Text style={styles.error}>{errors.projectImage}</Text>}

      {/* Meme Gallery — shown only for Meme category */}
      {isMeme && (
        <>
          <Text style={styles.label}>
            Meme Gallery ({totalImages}/4 images) *
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.galleryScroll}
            contentContainerStyle={styles.galleryContent}
          >
            {/* Main image thumbnail */}
            {projectImage && (
              <View style={styles.galleryThumb}>
                <Image source={{ uri: projectImage.uri }} style={styles.galleryThumbImage} />
                <View style={styles.galleryMainLabel}>
                  <Text style={styles.galleryMainLabelText}>Main</Text>
                </View>
              </View>
            )}

            {/* Gallery image thumbnails */}
            {galleryImages.map((img, i) => (
              <View key={i} style={styles.galleryThumb}>
                <Image source={{ uri: img.uri }} style={styles.galleryThumbImage} />
                <PressableScale
                  onPress={() => removeGalleryImage(i)}
                  style={styles.galleryRemove}
                >
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </PressableScale>
              </View>
            ))}

            {/* Add button */}
            {galleryImages.length < MAX_GALLERY_IMAGES && (
              <PressableScale onPress={handlePickGalleryImage} style={styles.galleryAddButton}>
                <Ionicons name="add" size={28} color={colors.textMuted} />
              </PressableScale>
            )}
          </ScrollView>
          {errors.galleryImages && <Text style={styles.error}>{errors.galleryImages}</Text>}
        </>
      )}

      {/* Target Pool */}
      <Text style={styles.label}>Target Pool (SOL) *</Text>
      <View style={styles.chipRow}>
        {TARGET_POOLS.map((val) => (
          <PressableScale
            key={val}
            onPress={() => updateField('targetPool', val)}
            style={[styles.chip, form.targetPool === val && styles.chipActive]}
          >
            <Text style={[styles.chipText, form.targetPool === val && styles.chipTextActive]}>
              {val} SOL
            </Text>
          </PressableScale>
        ))}
      </View>
      {errors.targetPool && <Text style={styles.error}>{errors.targetPool}</Text>}

      {/* Market Duration */}
      <Text style={styles.label}>Market Duration *</Text>
      <View style={styles.chipRow}>
        {DURATION_OPTIONS.map((opt) => (
          <PressableScale
            key={opt.value}
            onPress={() => updateField('marketDuration', opt.value)}
            style={[styles.chip, form.marketDuration === opt.value && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, form.marketDuration === opt.value && styles.chipTextActive]}
            >
              {opt.label}
            </Text>
          </PressableScale>
        ))}
      </View>
      {errors.marketDuration && <Text style={styles.error}>{errors.marketDuration}</Text>}

      {/* Fee info card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.infoText}>
          Creation fee: <Text style={styles.infoHighlight}>0.015 SOL</Text> — paid during on-chain
          transaction signing.
        </Text>
      </View>
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
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    ...typography.micro,
    color: colors.danger,
    marginTop: 4,
  },
  counter: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  imagePicker: {
    height: 140,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imagePickerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  imagePickerHint: {
    ...typography.micro,
    color: colors.textMuted,
  },
  imagePreviewContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeImage: {
    position: 'absolute',
    top: -8,
    right: '30%',
  },
  changeImage: {
    marginTop: spacing.sm,
  },
  changeImageText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipActive: {
    borderColor: 'rgba(139, 92, 246, 0.6)',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.15)',
  },
  infoText: {
    ...typography.micro,
    color: colors.textSecondary,
    flex: 1,
  },
  infoHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
  galleryScroll: {
    marginTop: 4,
  },
  galleryContent: {
    gap: spacing.sm,
    paddingVertical: 4,
  },
  galleryThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    position: 'relative',
  },
  galleryThumbImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  galleryMainLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    paddingVertical: 2,
    alignItems: 'center',
  },
  galleryMainLabelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  galleryRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  galleryAddButton: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
