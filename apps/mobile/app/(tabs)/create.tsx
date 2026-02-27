/**
 * Create Market Tab
 * Form to create a new prediction market
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

export default function CreateScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Create Market</Text>

      <View style={styles.heroCard}>
        <View style={styles.iconCircle}>
          <Ionicons name="add-circle" size={48} color={colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Launch a Prediction</Text>
        <Text style={styles.heroSubtext}>
          Create a market around your idea. Let the community vote, and if they believe — launch the token.
        </Text>
        <TouchableOpacity style={styles.ctaButton}>
          <Text style={styles.ctaText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.stepsContainer}>
        {[
          { icon: 'document-text', title: 'Describe Your Idea', desc: 'Add name, description, category, and social links' },
          { icon: 'image', title: 'Upload Media', desc: 'Add a project image and optional documents' },
          { icon: 'timer', title: 'Set Parameters', desc: 'Choose duration, target pool, and auto-launch' },
          { icon: 'rocket', title: 'Launch Market', desc: 'Pay creation fee and let voting begin' },
        ].map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 60, paddingBottom: 100 },
  screenTitle: { ...typography.display, color: colors.textPrimary, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  heroCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.sm },
  heroSubtext: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 24 },
  ctaButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  ctaText: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  stepsContainer: { paddingHorizontal: spacing.xl, gap: spacing.md },
  stepRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary,
  },
  stepNumberText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  stepContent: { flex: 1 },
  stepTitle: { ...typography.title, color: colors.textPrimary, marginBottom: 2 },
  stepDesc: { ...typography.caption, color: colors.textSecondary },
});
