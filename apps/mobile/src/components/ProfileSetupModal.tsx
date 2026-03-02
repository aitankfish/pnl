/**
 * ProfileSetupModal — Post-login onboarding for username + avatar selection
 * Shown when a user signs in for the first time (no username in profile).
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius, typography } from '../theme';
import {
  COSMIC_AVATARS,
  resolveAvatarUrl,
  type ProfileUpdateData,
} from '../hooks/useProfile';

interface ProfileSetupModalProps {
  visible: boolean;
  onComplete: () => void;
  updateProfile: (data: ProfileUpdateData) => Promise<boolean>;
  generateUsername: () => Promise<string>;
  checkUsername: (username: string) => Promise<{ available: boolean; error?: string }>;
  email?: string;
}

export function ProfileSetupModal({
  visible,
  onComplete,
  updateProfile,
  generateUsername,
  checkUsername,
  email,
}: ProfileSetupModalProps) {
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [bio, setBio] = useState('');
  const [twitter, setTwitter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  const handleRandomUsername = useCallback(async () => {
    setIsGenerating(true);
    setUsernameError('');
    try {
      const name = await generateUsername();
      setUsername(name);
    } finally {
      setIsGenerating(false);
    }
  }, [generateUsername]);

  const handleUsernameChange = useCallback((text: string) => {
    // Only allow alphanumeric and underscores
    const cleaned = text.replace(/[^a-zA-Z0-9_]/g, '');
    setUsername(cleaned);
    setUsernameError('');
  }, []);

  const validateUsername = useCallback(
    async (name: string): Promise<boolean> => {
      if (!name.trim()) {
        setUsernameError('Username is required');
        return false;
      }
      if (name.length < 3) {
        setUsernameError('At least 3 characters');
        return false;
      }
      if (name.length > 20) {
        setUsernameError('Maximum 20 characters');
        return false;
      }
      const { available, error } = await checkUsername(name);
      if (!available) {
        setUsernameError(error || 'Username is taken');
        return false;
      }
      return true;
    },
    [checkUsername],
  );

  const handleSave = useCallback(async () => {
    const finalUsername = username.trim();

    // If no username entered, generate one
    let usernameToSave = finalUsername;
    if (!usernameToSave) {
      setIsGenerating(true);
      usernameToSave = await generateUsername();
      setIsGenerating(false);
    } else {
      const valid = await validateUsername(usernameToSave);
      if (!valid) return;
    }

    setIsSaving(true);

    // Pick avatar (selected or random)
    let avatarPath = selectedAvatar;
    if (!avatarPath) {
      const random = COSMIC_AVATARS[Math.floor(Math.random() * COSMIC_AVATARS.length)];
      avatarPath = random.path;
    }

    const success = await updateProfile({
      username: usernameToSave,
      profilePhotoUrl: avatarPath,
      bio: bio.trim() || undefined,
      twitter: twitter.trim() || undefined,
      email,
    });

    setIsSaving(false);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }
  }, [username, selectedAvatar, bio, twitter, email, updateProfile, generateUsername, validateUsername, onComplete]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {}}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="planet" size={48} color={colors.primary} />
            <Text style={styles.title}>Welcome to PNL</Text>
            <Text style={styles.subtitle}>
              Set up your cosmic identity to start predicting and launching.
            </Text>
          </View>

          {/* Avatar selection */}
          <Text style={styles.sectionLabel}>Choose Your Avatar</Text>
          <View style={styles.avatarGrid}>
            {COSMIC_AVATARS.map((avatar) => {
              const isSelected = selectedAvatar === avatar.path;
              return (
                <PressableScale
                  key={avatar.id}
                  onPress={() => {
                    setSelectedAvatar(avatar.path);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.avatarItem,
                    isSelected && styles.avatarItemSelected,
                  ]}
                >
                  <Image
                    source={{ uri: resolveAvatarUrl(avatar.path) }}
                    style={styles.avatarImage}
                  />
                  <Text
                    style={[
                      styles.avatarName,
                      isSelected && styles.avatarNameSelected,
                    ]}
                  >
                    {avatar.name}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </View>

          {/* Username */}
          <Text style={styles.sectionLabel}>Username</Text>
          <View style={styles.usernameRow}>
            <View
              style={[
                styles.inputContainer,
                usernameError ? styles.inputError : null,
              ]}
            >
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="Choose a username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
            </View>
            <PressableScale
              onPress={handleRandomUsername}
              style={styles.randomBtn}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="dice" size={22} color={colors.primary} />
              )}
            </PressableScale>
          </View>
          {usernameError ? (
            <Text style={styles.errorText}>{usernameError}</Text>
          ) : (
            <Text style={styles.hintText}>
              3-20 characters, letters, numbers, and underscores
            </Text>
          )}

          {/* Bio (optional) */}
          <Text style={styles.sectionLabel}>Bio (optional)</Text>
          <TextInput
            style={styles.bioInput}
            placeholder="Tell the cosmos about yourself..."
            placeholderTextColor={colors.textMuted}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={160}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length}/160</Text>

          {/* Twitter (optional) */}
          <Text style={styles.sectionLabel}>Twitter / X (optional)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="logo-twitter" size={16} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.inputPrefix}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="your_handle"
              placeholderTextColor={colors.textMuted}
              value={twitter}
              onChangeText={(text) => setTwitter(text.replace(/[^a-zA-Z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={15}
            />
          </View>
          <Text style={styles.hintText}>Your X / Twitter handle</Text>

          {/* Save button */}
          <PressableScale onPress={handleSave} style={styles.saveBtn}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="rocket" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Launch My Profile</Text>
                </>
              )}
            </LinearGradient>
          </PressableScale>

          {/* Skip link */}
          <PressableScale onPress={handleSave} haptic={false}>
            <Text style={styles.skipText}>Skip for now (random name & avatar)</Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 28,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  sectionLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  // Avatar grid
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  avatarItem: {
    width: 76,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  avatarItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryGlow,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
  },
  avatarName: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  avatarNameSelected: {
    color: colors.primary,
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Username
  usernameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputPrefix: {
    ...typography.body,
    color: colors.textMuted,
    marginRight: 2,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    paddingVertical: spacing.sm + 4,
  },
  randomBtn: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.micro,
    color: colors.danger,
    marginTop: 4,
  },
  hintText: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 4,
  },
  // Bio
  bioInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm + 4,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 80,
  },
  charCount: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  // Save
  saveBtn: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: spacing.sm,
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 17,
  },
  skipText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
});
