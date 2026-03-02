/**
 * Login Screen — Bottom-aligned, OTP boxes, animated transitions
 * Email OTP + OAuth (Google/Apple)
 * Polished with gradient icon circles, stagger animations, and gradient buttons
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../src/theme';
import { useAuth } from '../src/providers/AuthProvider';
import { PressableScale, OTPInput } from '../src/components';

type LoginStep = 'choose' | 'email' | 'otp';

// Gradient icon circle for auth method buttons
function GradientIcon({
  name,
  gradientColors,
}: {
  name: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
}) {
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={iconStyles.circle}
    >
      <Ionicons name={name} size={18} color="#fff" />
    </LinearGradient>
  );
}

const iconStyles = StyleSheet.create({
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function LoginScreen() {
  const { sendCode, loginWithCode, emailState, loginWithOAuth, oauthState } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<LoginStep>('choose');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [emailFocused, setEmailFocused] = useState(false);

  const fadeAnim = useRef(new RNAnimated.Value(1)).current;
  const logoScale = useRef(new RNAnimated.Value(0.85)).current;
  const logoOpacity = useRef(new RNAnimated.Value(0)).current;

  // Stagger method buttons
  const method1Anim = useRef(new RNAnimated.Value(0)).current;
  const method2Anim = useRef(new RNAnimated.Value(0)).current;
  const method3Anim = useRef(new RNAnimated.Value(0)).current;

  const isLoading =
    emailState.status === 'sending-code' ||
    emailState.status === 'submitting-code' ||
    oauthState.status === 'loading';

  // Logo entrance animation
  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      RNAnimated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoScale, logoOpacity]);

  // Stagger method buttons when step is 'choose'
  useEffect(() => {
    if (step === 'choose') {
      method1Anim.setValue(0);
      method2Anim.setValue(0);
      method3Anim.setValue(0);
      RNAnimated.stagger(80, [
        RNAnimated.timing(method1Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.timing(method2Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.timing(method3Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [step, method1Anim, method2Anim, method3Anim]);

  // Animated step transition
  const transitionTo = useCallback(
    (nextStep: LoginStep) => {
      RNAnimated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setStep(nextStep);
        setError(null);
        RNAnimated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    },
    [fadeAnim],
  );

  // Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setError(null);
    try {
      await sendCode({ email: email.trim() });
      setResendCountdown(60);
      transitionTo('otp');
    } catch (e: any) {
      setError(e?.message || 'Failed to send code');
    }
  };

  const handleVerifyCode = async (code: string) => {
    setError(null);
    try {
      await loginWithCode({ code, email: email.trim() });
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Invalid code');
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null);
    try {
      await loginWithOAuth({ provider });
      router.back();
    } catch (e: any) {
      setError(e?.message || `${provider} login failed`);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    try {
      await sendCode({ email: email.trim() });
      setResendCountdown(60);
    } catch (e: any) {
      setError(e?.message || 'Failed to resend code');
    }
  };

  const methodAnimStyle = (anim: RNAnimated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Close button */}
      <PressableScale
        style={[styles.closeButton, { top: insets.top + 12 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={24} color={colors.textPrimary} />
      </PressableScale>

      {/* Brand section — top */}
      <RNAnimated.View
        style={[
          styles.brandSection,
          { paddingTop: insets.top + 60, opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Text style={styles.logo}>PNL</Text>
        <Text style={styles.tagline}>Predict & Launch</Text>
        <Text style={styles.subtitle}>Connect to start predicting</Text>
      </RNAnimated.View>

      {/* Content — bottom aligned */}
      <View style={styles.spacer} />

      <RNAnimated.View style={[styles.content, { opacity: fadeAnim, paddingBottom: insets.bottom + 24 }]}>
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Step: Choose */}
        {step === 'choose' && (
          <View style={styles.methods}>
            <RNAnimated.View style={methodAnimStyle(method1Anim)}>
              <PressableScale style={styles.methodButton} onPress={() => transitionTo('email')}>
                <GradientIcon name="mail-outline" gradientColors={['#6366f1', '#818cf8']} />
                <Text style={styles.methodText}>Continue with Email</Text>
              </PressableScale>
            </RNAnimated.View>

            <RNAnimated.View style={methodAnimStyle(method2Anim)}>
              <PressableScale
                style={styles.methodButton}
                onPress={() => handleOAuth('google')}
                disabled={isLoading}
              >
                <GradientIcon name="logo-google" gradientColors={['#ea4335', '#fa7b17']} />
                <Text style={styles.methodText}>Continue with Google</Text>
                {oauthState.status === 'loading' && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </PressableScale>
            </RNAnimated.View>

            {Platform.OS === 'ios' && (
              <RNAnimated.View style={methodAnimStyle(method3Anim)}>
                <PressableScale
                  style={styles.methodButton}
                  onPress={() => handleOAuth('apple')}
                  disabled={isLoading}
                >
                  <GradientIcon name="logo-apple" gradientColors={['#6b7280', '#d1d5db']} />
                  <Text style={styles.methodText}>Continue with Apple</Text>
                </PressableScale>
              </RNAnimated.View>
            )}
          </View>
        )}

        {/* Step: Email */}
        {step === 'email' && (
          <View style={styles.inputSection}>
            <Text style={styles.stepTitle}>Enter your email</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
              editable={!isLoading}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
            <PressableScale
              style={[styles.sendCodeWrapper, (!email.trim() || isLoading) && styles.disabled]}
              onPress={handleSendCode}
              disabled={!email.trim() || isLoading}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendCodeGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Code</Text>
                )}
              </LinearGradient>
            </PressableScale>
            <PressableScale
              onPress={() => transitionTo('choose')}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>Back to login methods</Text>
            </PressableScale>
          </View>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <View style={styles.inputSection}>
            <Text style={styles.stepTitle}>Verify your email</Text>
            <Text style={styles.stepHint}>Enter the 6-digit code sent to {email}</Text>
            <OTPInput
              onComplete={handleVerifyCode}
              style={styles.otpRow}
            />
            {isLoading && (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
            )}
            <PressableScale
              onPress={handleResend}
              disabled={resendCountdown > 0}
              style={styles.resendLink}
            >
              <Text style={[styles.backLinkText, resendCountdown > 0 && { color: colors.textMuted }]}>
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => transitionTo('email')}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>Use different email</Text>
            </PressableScale>
          </View>
        )}
      </RNAnimated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  brandSection: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 40,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 4,
  },
  tagline: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  spacer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  methods: {
    gap: spacing.sm,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.md,
  },
  methodText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  inputSection: {
    gap: spacing.md,
  },
  stepTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  stepHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 18,
  },
  inputFocused: {
    borderColor: colors.primary,
    ...(Platform.OS === 'ios' && {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    }),
  },
  otpRow: {
    marginVertical: spacing.sm,
  },
  sendCodeWrapper: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  sendCodeGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },
  resendLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  backLinkText: {
    ...typography.caption,
    color: colors.primary,
  },
});
