import React from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import type { CreateMarketForm, SocialLinks } from '../../hooks/useCreateMarket';

const SOCIAL_FIELDS: Array<{
  key: keyof SocialLinks;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  keyboardType?: 'url' | 'default';
}> = [
  { key: 'website', label: 'Website', icon: 'globe-outline', placeholder: 'https://yourproject.com' },
  { key: 'github', label: 'GitHub', icon: 'logo-github', placeholder: 'https://github.com/...' },
  { key: 'twitter', label: 'Twitter / X', icon: 'logo-twitter', placeholder: 'https://x.com/...' },
  { key: 'discord', label: 'Discord', icon: 'logo-discord', placeholder: 'https://discord.gg/...' },
  { key: 'telegram', label: 'Telegram', icon: 'paper-plane-outline', placeholder: 'https://t.me/...' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', placeholder: 'https://linkedin.com/in/...' },
];

interface SocialLinksStepProps {
  form: CreateMarketForm;
  updateSocialLink: (platform: keyof SocialLinks, value: string) => void;
  updateField: (key: keyof Omit<CreateMarketForm, 'socialLinks'>, value: string) => void;
}

export function SocialLinksStep({ form, updateSocialLink, updateField }: SocialLinksStepProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Social Links & Notes</Text>
      <Text style={styles.stepSubtitle}>All fields are optional — add what you have</Text>

      {SOCIAL_FIELDS.map((field) => (
        <View key={field.key} style={styles.fieldRow}>
          <View style={styles.iconContainer}>
            <Ionicons name={field.icon} size={20} color={colors.textMuted} />
          </View>
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              style={styles.input}
              value={form.socialLinks[field.key]}
              onChangeText={(v) => updateSocialLink(field.key, v)}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectionColor={colors.primary}
            />
          </View>
        </View>
      ))}

      {/* Additional Notes */}
      <Text style={styles.notesLabel}>Additional Notes</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={form.additionalNotes}
        onChangeText={(v) => updateField('additionalNotes', v)}
        placeholder="Anything else voters should know..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        selectionColor={colors.primary}
      />
      <Text style={styles.counter}>{form.additionalNotes.length} chars</Text>
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    ...typography.micro,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.lg,
  },
  notesInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  counter: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
});
