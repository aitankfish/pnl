/**
 * Create Market Screen — 5-step wizard for launching a prediction market
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '../src/components';
import { StepIndicator } from '../src/components/create/StepIndicator';
import { BasicInfoStep } from '../src/components/create/BasicInfoStep';
import { TokenConfigStep } from '../src/components/create/TokenConfigStep';
import { PitchVideoStep } from '../src/components/create/PitchVideoStep';
import { SocialLinksStep } from '../src/components/create/SocialLinksStep';
import { ReviewStep } from '../src/components/create/ReviewStep';
import { SubmissionOverlay } from '../src/components/create/SubmissionOverlay';
import { useCreateMarket } from '../src/hooks/useCreateMarket';
import { colors, spacing, borderRadius, typography } from '../src/theme';

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const {
    form,
    projectImage,
    galleryImages,
    pitchVideo,
    errors,
    currentStep,
    submissionStep,
    createdMarketId,
    updateField,
    updateSocialLink,
    setProjectImage,
    clearProjectImage,
    addGalleryImage,
    removeGalleryImage,
    setPitchVideo,
    clearPitchVideo,
    hasDraft,
    nextStep,
    prevStep,
    submit,
    reset,
    clearDraft,
  } = useCreateMarket();

  const isSubmitting = submissionStep !== 'idle' && submissionStep !== 'success' && submissionStep !== 'error';
  const showOverlay = isSubmitting;

  // Draft-restored toast
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastShown = useRef(false);

  useEffect(() => {
    if (hasDraft && !toastShown.current) {
      toastShown.current = true;
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [hasDraft, toastOpacity]);

  const handleClearDraft = useCallback(() => {
    Alert.alert('Clear Draft', 'Discard your saved progress and start fresh?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => { reset(); },
      },
    ]);
  }, [reset]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      prevStep();
    } else {
      router.back();
    }
  }, [currentStep, prevStep]);

  const handleNext = useCallback(() => {
    const ok = nextStep();
    if (ok) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [nextStep]);

  const handleSubmit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await submit();
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to the new market
      if (createdMarketId) {
        router.replace(`/market/${createdMarketId}`);
      } else {
        router.back();
      }
    }
  }, [submit, createdMarketId]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BasicInfoStep form={form} errors={errors} updateField={updateField} />;
      case 1:
        return (
          <TokenConfigStep
            form={form}
            errors={errors}
            projectImage={projectImage}
            galleryImages={galleryImages}
            updateField={updateField}
            setProjectImage={setProjectImage}
            clearProjectImage={clearProjectImage}
            addGalleryImage={addGalleryImage}
            removeGalleryImage={removeGalleryImage}
          />
        );
      case 2:
        return (
          <PitchVideoStep
            pitchVideo={pitchVideo}
            setPitchVideo={setPitchVideo}
            clearPitchVideo={clearPitchVideo}
          />
        );
      case 3:
        return (
          <SocialLinksStep
            form={form}
            updateSocialLink={updateSocialLink}
            updateField={updateField}
          />
        );
      case 4:
        return (
          <ReviewStep
            form={form}
            projectImage={projectImage}
            galleryImages={galleryImages}
            pitchVideo={pitchVideo}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={handleBack} style={styles.backButton}>
          <Ionicons
            name={currentStep > 0 ? 'arrow-back' : 'close'}
            size={24}
            color={colors.textPrimary}
          />
        </PressableScale>
        <Text style={styles.headerTitle}>Create Market</Text>
        {hasDraft ? (
          <PressableScale onPress={handleClearDraft} style={styles.backButton}>
            <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
          </PressableScale>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Step indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Step content */}
      <KeyboardAvoidingView
        style={styles.stepContent}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 100}
      >
        {renderStep()}
      </KeyboardAvoidingView>

      {/* Bottom navigation (except on Review which has its own submit button) */}
      {currentStep < 4 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          {currentStep > 0 ? (
            <PressableScale onPress={prevStep} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </PressableScale>
          ) : (
            <View style={styles.secondaryButton} />
          )}

          <PressableScale onPress={handleNext} style={styles.nextButton}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextGradient}
            >
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </PressableScale>
        </View>
      )}

      {/* Draft restored toast */}
      <Animated.View style={[styles.draftToast, { opacity: toastOpacity }]} pointerEvents="none">
        <Ionicons name="document-text-outline" size={14} color={colors.accent} />
        <Text style={styles.draftToastText}>Draft restored</Text>
      </Animated.View>

      {/* Submission overlay */}
      <SubmissionOverlay step={submissionStep} visible={showOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  stepContent: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    minWidth: 80,
  },
  secondaryButtonText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  nextButton: {
    minWidth: 120,
  },
  nextGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  nextText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  draftToast: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 35, 55, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  draftToastText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
