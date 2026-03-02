/**
 * Deposit / Receive Bottom Sheet
 * Shows QR code of wallet address + copyable address
 */

import React, { forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCodeStyled from 'react-native-qrcode-styled';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../BottomSheet';
import { PressableScale } from '../PressableScale';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface DepositSheetProps {
  walletAddress: string;
  onClose?: () => void;
}

export const DepositSheet = forwardRef<GorhomBottomSheet, DepositSheetProps>(
  ({ walletAddress, onClose }, ref) => {
    const handleCopy = useCallback(async () => {
      await Clipboard.setStringAsync(walletAddress);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [walletAddress]);

    return (
      <BottomSheet ref={ref} snapPoints={['70%']} onClose={onClose}>
        <View style={styles.container}>
          <Text style={styles.title}>Receive</Text>
          <Text style={styles.subtitle}>
            Send SOL or SPL tokens to this address
          </Text>

          <View style={styles.qrContainer}>
            <QRCodeStyled
              data={walletAddress}
              style={styles.qrCode}
              pieceSize={6}
              color={colors.textPrimary}
              pieceCornerType="rounded"
              isPiecesGlued
              padding={16}
            />
          </View>

          <View style={styles.networkBadge}>
            <View style={styles.networkDot} />
            <Text style={styles.networkText}>Solana Mainnet</Text>
          </View>

          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Your Wallet Address</Text>
            <Text style={styles.address} selectable>
              {walletAddress}
            </Text>
          </View>

          <PressableScale onPress={handleCopy} style={styles.copyButton}>
            <Ionicons name="copy-outline" size={18} color="#fff" />
            <Text style={styles.copyText}>Copy Address</Text>
          </PressableScale>
        </View>
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: spacing.md,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  networkText: {
    ...typography.micro,
    color: colors.success,
  },
  addressContainer: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addressLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: 6,
  },
  address: {
    ...typography.caption,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    width: '100%',
    justifyContent: 'center',
  },
  copyText: {
    ...typography.bodyBold,
    color: '#fff',
  },
});
