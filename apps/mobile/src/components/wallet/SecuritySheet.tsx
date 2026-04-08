/**
 * Security Bottom Sheet
 * Export private key, display full wallet address
 */

import React, { forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Linking } from 'react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { BottomSheet } from '../BottomSheet';
import { PressableScale } from '../PressableScale';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface SecuritySheetProps {
  walletAddress: string;
  onClose?: () => void;
}

export const SecuritySheet = forwardRef<GorhomBottomSheet, SecuritySheetProps>(
  ({ walletAddress, onClose }, ref) => {
    const handleCopyAddress = useCallback(async () => {
      await Clipboard.setStringAsync(walletAddress);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [walletAddress]);

    const handleExportKey = useCallback(async () => {
      Alert.alert(
        'Export Private Key',
        'For security, private key export opens in a browser where Privy can securely display your key. You\'ll need to log in on the web to view it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open in Browser',
            onPress: async () => {
              try {
                await WebBrowser.openBrowserAsync('https://pnl.market/wallet', {
                  presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                });
              } catch {
                // Fallback to external browser
                Linking.openURL('https://pnl.market/wallet');
              }
            },
          },
        ],
      );
    }, []);

    return (
      <BottomSheet ref={ref} snapPoints={['55%']} onClose={onClose}>
        <View style={styles.container}>
          <Text style={styles.title}>Security</Text>

          {/* Wallet Address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="wallet-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Wallet Address</Text>
            </View>
            <Text style={styles.address} selectable>
              {walletAddress}
            </Text>
            <PressableScale onPress={handleCopyAddress} style={styles.actionRow}>
              <Ionicons name="copy-outline" size={16} color={colors.primary} />
              <Text style={styles.actionText}>Copy Address</Text>
            </PressableScale>
          </View>

          {/* Export Private Key */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Private Key</Text>
            </View>
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={16} color={colors.warning} />
              <Text style={styles.warningText}>
                Never share your private key. Anyone with it can access your funds.
              </Text>
            </View>
            <PressableScale
              onPress={handleExportKey}
              style={styles.exportButton}
            >
              <Ionicons name="open-outline" size={18} color={colors.danger} />
              <Text style={styles.exportText}>Export Private Key</Text>
            </PressableScale>
          </View>
        </View>
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  section: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  address: {
    ...typography.caption,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  warningText: {
    ...typography.micro,
    color: colors.warning,
    flex: 1,
    lineHeight: 18,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: borderRadius.md,
    paddingVertical: 12,
  },
  exportText: {
    ...typography.captionBold,
    color: colors.danger,
  },
});
