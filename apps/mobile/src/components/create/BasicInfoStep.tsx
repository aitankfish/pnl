import React, { useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { PressableScale } from '../PressableScale';
import { colors, spacing, borderRadius, typography } from '../../theme';
import type { CreateMarketForm, FormErrors } from '../../hooks/useCreateMarket';

const CATEGORIES = [
  'DeFi', 'Gaming', 'NFT', 'AI/ML', 'Social', 'Infrastructure', 'DAO', 'Meme', 'Creator',
  'Healthcare', 'Science', 'Education', 'Finance', 'Commerce', 'Real Estate', 'Energy',
  'Media', 'Manufacturing', 'Mobility', 'Other',
];

const PROJECT_TYPES = ['Protocol', 'Application', 'Platform', 'Service', 'Tool'];
const PROJECT_STAGES = ['Idea', 'Prototype', 'MVP', 'Beta', 'Launched'];

interface BasicInfoStepProps {
  form: CreateMarketForm;
  errors: FormErrors;
  updateField: (key: keyof Omit<CreateMarketForm, 'socialLinks'>, value: string) => void;
}

export function BasicInfoStep({ form, errors, updateField }: BasicInfoStepProps) {
  const categorySheetRef = useRef<GorhomBottomSheet>(null);
  const snapPoints = useMemo(() => ['50%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
    ),
    [],
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Basic Information</Text>
        <Text style={styles.stepSubtitle}>Tell us about your project</Text>

        {/* Project Name */}
        <Text style={styles.label}>Project Name *</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={form.name}
          onChangeText={(v) => updateField('name', v)}
          placeholder="e.g. My DeFi Protocol"
          placeholderTextColor={colors.textMuted}
          maxLength={32}
          selectionColor={colors.primary}
        />
        {errors.name && <Text style={styles.error}>{errors.name}</Text>}
        <Text style={styles.counter}>{new TextEncoder().encode(form.name).length}/32 bytes</Text>

        {/* Description */}
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.multiline, errors.description && styles.inputError]}
          value={form.description}
          onChangeText={(v) => updateField('description', v)}
          placeholder="Describe your project..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          selectionColor={colors.primary}
        />
        {errors.description && <Text style={styles.error}>{errors.description}</Text>}
        <Text style={styles.counter}>{form.description.length} chars</Text>

        {/* Category */}
        <Text style={styles.label}>Category *</Text>
        <PressableScale
          onPress={() => categorySheetRef.current?.expand()}
          style={[styles.input, styles.selector, errors.category && styles.inputError]}
        >
          <Text style={form.category ? styles.selectorText : styles.selectorPlaceholder}>
            {form.category || 'Select a category'}
          </Text>
        </PressableScale>
        {errors.category && <Text style={styles.error}>{errors.category}</Text>}

        {/* Project Type */}
        <Text style={styles.label}>Project Type *</Text>
        <View style={styles.chipRow}>
          {PROJECT_TYPES.map((t) => (
            <PressableScale
              key={t}
              onPress={() => updateField('projectType', t)}
              style={[styles.chip, form.projectType === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.projectType === t && styles.chipTextActive]}>
                {t}
              </Text>
            </PressableScale>
          ))}
        </View>
        {errors.projectType && <Text style={styles.error}>{errors.projectType}</Text>}

        {/* Project Stage */}
        <Text style={styles.label}>Project Stage *</Text>
        <View style={styles.chipRow}>
          {PROJECT_STAGES.map((s) => (
            <PressableScale
              key={s}
              onPress={() => updateField('projectStage', s)}
              style={[styles.chip, form.projectStage === s && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.projectStage === s && styles.chipTextActive]}>
                {s}
              </Text>
            </PressableScale>
          ))}
        </View>
        {errors.projectStage && <Text style={styles.error}>{errors.projectStage}</Text>}

        {/* Team Size */}
        <Text style={styles.label}>Team Size *</Text>
        <TextInput
          style={[styles.input, errors.teamSize && styles.inputError]}
          value={form.teamSize}
          onChangeText={(v) => updateField('teamSize', v.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 5"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          selectionColor={colors.primary}
        />
        {errors.teamSize && <Text style={styles.error}>{errors.teamSize}</Text>}

        {/* Location */}
        <Text style={styles.label}>Location (optional)</Text>
        <TextInput
          style={styles.input}
          value={form.location}
          onChangeText={(v) => updateField('location', v)}
          placeholder="e.g. San Francisco, CA"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
        />
      </ScrollView>

      {/* Category Bottom Sheet */}
      <GorhomBottomSheet
        ref={categorySheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Select Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <PressableScale
                key={cat}
                onPress={() => {
                  updateField('category', cat);
                  categorySheetRef.current?.close();
                }}
                style={[styles.categoryCell, form.category === cat && styles.categoryCellActive]}
              >
                <Text
                  style={[
                    styles.categoryCellText,
                    form.category === cat && styles.categoryCellTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </PressableScale>
            ))}
          </View>
        </BottomSheetView>
      </GorhomBottomSheet>
    </>
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
  multiline: {
    minHeight: 100,
    paddingTop: 14,
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
  selector: {
    justifyContent: 'center',
  },
  selectorText: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  selectorPlaceholder: {
    color: colors.textMuted,
    fontSize: 16,
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
  // Category bottom sheet
  sheetBg: {
    backgroundColor: colors.sheetBackground,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
  },
  sheetHandle: { backgroundColor: colors.sheetHandle, width: 40 },
  sheetContent: { flex: 1, paddingHorizontal: spacing.md },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  categoryCell: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  categoryCellActive: {
    borderColor: 'rgba(139, 92, 246, 0.6)',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  categoryCellText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  categoryCellTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
