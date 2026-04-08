/**
 * Send Token Bottom Sheet
 * Token selector, recipient address, amount, sign & send
 */

import React, { forwardRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { getSolanaConnection } from '@pnl/shared/solana';
import { parseError } from '@pnl/shared/utils';
import type { TokenBalance } from '@pnl/shared/hooks';
import { BottomSheet } from '../BottomSheet';
import { PressableScale } from '../PressableScale';
import { useAuth } from '../../providers/AuthProvider';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface SendableToken {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  balance: number;
  decimals: number;
  isNative: boolean;
  programId: string;
}

interface SendSheetProps {
  walletAddress: string;
  solBalance: number;
  tokens: TokenBalance[];
  onClose?: () => void;
  onSuccess?: (signature: string) => void;
}

type Step = 'form' | 'review' | 'confirming' | 'success' | 'error';

export const SendSheet = forwardRef<GorhomBottomSheet, SendSheetProps>(
  ({ walletAddress, solBalance, tokens, onClose, onSuccess }, ref) => {
    const { solanaWallet } = useAuth();
    const [selectedToken, setSelectedToken] = useState<SendableToken | null>(null);
    const [showTokenPicker, setShowTokenPicker] = useState(false);
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [step, setStep] = useState<Step>('form');
    const [txSignature, setTxSignature] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Build sendable token list: SOL first, then SPL tokens
    const sendableTokens = useMemo<SendableToken[]>(() => {
      const sol: SendableToken = {
        mint: 'native',
        symbol: 'SOL',
        name: 'Solana',
        balance: solBalance,
        decimals: 9,
        isNative: true,
        programId: '',
      };
      const spls: SendableToken[] = tokens.map((t) => ({
        mint: t.mint,
        symbol: t.symbol || 'Unknown',
        name: t.name || 'Unknown Token',
        logoURI: t.logoURI,
        balance: t.uiAmount,
        decimals: t.decimals,
        isNative: false,
        programId: t.programId,
      }));
      return [sol, ...spls];
    }, [solBalance, tokens]);

    // Default to SOL if nothing selected
    const activeToken = selectedToken || sendableTokens[0];

    const isValidAddress = useCallback((addr: string): boolean => {
      try {
        new PublicKey(addr);
        return addr.length >= 32 && addr.length <= 44;
      } catch {
        return false;
      }
    }, []);

    const parsedAmount = parseFloat(amount) || 0;
    const maxAmount = activeToken?.isNative
      ? Math.max(0, (activeToken?.balance || 0) - 0.01) // Reserve for fees
      : activeToken?.balance || 0;
    const canSend =
      isValidAddress(recipient) &&
      parsedAmount > 0 &&
      parsedAmount <= maxAmount &&
      recipient !== walletAddress;

    const handleMax = useCallback(() => {
      setAmount(maxAmount > 0 ? maxAmount.toString() : '0');
    }, [maxAmount]);

    const handleReview = useCallback(() => {
      if (!canSend || !activeToken) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep('review');
    }, [canSend, activeToken]);

    const handleSend = useCallback(async () => {
      if (!canSend || !activeToken) return;
      if (solanaWallet.status !== 'connected' || !solanaWallet.wallets?.[0]) {
        Alert.alert('Error', 'Wallet not connected');
        return;
      }

      setStep('confirming');

      try {
        const connection = await getSolanaConnection();
        const senderPubkey = new PublicKey(walletAddress);
        const recipientPubkey = new PublicKey(recipient);
        const { blockhash } = await connection.getLatestBlockhash('confirmed');

        let instructions;

        if (activeToken.isNative) {
          // SOL transfer
          instructions = [
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: recipientPubkey,
              lamports: Math.floor(parsedAmount * LAMPORTS_PER_SOL),
            }),
          ];
        } else {
          // SPL token transfer
          const mintPubkey = new PublicKey(activeToken.mint);
          const tokenProgramId = activeToken.programId === TOKEN_2022_PROGRAM_ID.toBase58()
            ? TOKEN_2022_PROGRAM_ID
            : TOKEN_PROGRAM_ID;

          const senderATA = getAssociatedTokenAddressSync(
            mintPubkey,
            senderPubkey,
            false,
            tokenProgramId,
          );
          const recipientATA = getAssociatedTokenAddressSync(
            mintPubkey,
            recipientPubkey,
            false,
            tokenProgramId,
          );

          instructions = [];

          // Check if recipient ATA exists
          const recipientATAInfo = await connection.getAccountInfo(recipientATA);
          if (!recipientATAInfo) {
            instructions.push(
              createAssociatedTokenAccountInstruction(
                senderPubkey,
                recipientATA,
                recipientPubkey,
                mintPubkey,
                tokenProgramId,
              ),
            );
          }

          const rawAmount = Math.floor(parsedAmount * 10 ** activeToken.decimals);
          instructions.push(
            createTransferInstruction(
              senderATA,
              recipientATA,
              senderPubkey,
              BigInt(rawAmount),
              [],
              tokenProgramId,
            ),
          );
        }

        const message = new TransactionMessage({
          payerKey: senderPubkey,
          recentBlockhash: blockhash,
          instructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(message);

        // Sign & send via Privy embedded wallet
        const provider = await solanaWallet.wallets[0].getProvider();
        const { signature } = await (provider as any).request({
          method: 'signAndSendTransaction',
          params: { transaction, connection },
        });

        await connection.confirmTransaction(signature, 'confirmed');

        setTxSignature(signature);
        setStep('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess?.(signature);
      } catch (err: any) {
        console.error('Send failed:', err);
        const parsed = parseError(err);
        setErrorMsg(parsed.message);
        setStep('error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }, [canSend, activeToken, walletAddress, recipient, parsedAmount, solanaWallet, onSuccess]);

    const handleReset = useCallback(() => {
      setRecipient('');
      setAmount('');
      setStep('form');
      setTxSignature('');
      setErrorMsg('');
    }, []);

    // Token picker sub-view
    if (showTokenPicker) {
      return (
        <BottomSheet ref={ref} snapPoints={['75%']} onClose={onClose}>
          <View style={styles.container}>
            <View style={styles.pickerHeader}>
              <PressableScale onPress={() => setShowTokenPicker(false)}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </PressableScale>
              <Text style={styles.title}>Select Token</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={styles.tokenList}>
              {sendableTokens.map((token) => (
                <PressableScale
                  key={token.mint}
                  style={[
                    styles.tokenRow,
                    activeToken?.mint === token.mint && styles.tokenRowActive,
                  ]}
                  onPress={() => {
                    setSelectedToken(token);
                    setShowTokenPicker(false);
                    setAmount('');
                  }}
                >
                  {token.logoURI ? (
                    <Image source={{ uri: token.logoURI }} style={styles.tokenLogo} />
                  ) : (
                    <View style={[styles.tokenLogo, styles.tokenLogoPlaceholder]}>
                      <Text style={styles.tokenLogoText}>
                        {token.symbol?.charAt(0) || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.tokenInfo}>
                    <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                    <Text style={styles.tokenName} numberOfLines={1}>{token.name}</Text>
                  </View>
                  <Text style={styles.tokenBalance}>
                    {token.balance.toFixed(token.isNative ? 4 : 2)}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        </BottomSheet>
      );
    }

    // Success view
    if (step === 'success') {
      return (
        <BottomSheet ref={ref} snapPoints={['50%']} onClose={onClose}>
          <View style={[styles.container, styles.center]}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            </View>
            <Text style={styles.title}>Sent!</Text>
            <Text style={styles.subtitle}>
              {parsedAmount} {activeToken?.symbol} sent successfully
            </Text>
            <Text style={styles.sigText} numberOfLines={1} selectable>
              {txSignature}
            </Text>
            <PressableScale onPress={handleReset} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </PressableScale>
          </View>
        </BottomSheet>
      );
    }

    // Error view
    if (step === 'error') {
      return (
        <BottomSheet ref={ref} snapPoints={['50%']} onClose={onClose}>
          <View style={[styles.container, styles.center]}>
            <Ionicons name="close-circle" size={64} color={colors.danger} />
            <Text style={styles.title}>Failed</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <PressableScale onPress={handleReset} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </PressableScale>
          </View>
        </BottomSheet>
      );
    }

    return (
      <BottomSheet ref={ref} snapPoints={['75%']} onClose={onClose}>
        <View style={styles.container}>
          <Text style={styles.title}>Send</Text>

          {/* Token Selector */}
          <Text style={styles.label}>Token</Text>
          <PressableScale
            onPress={() => setShowTokenPicker(true)}
            style={styles.tokenSelector}
          >
            {activeToken?.logoURI ? (
              <Image source={{ uri: activeToken.logoURI }} style={styles.selectorLogo} />
            ) : (
              <View style={[styles.selectorLogo, styles.tokenLogoPlaceholder]}>
                <Text style={styles.tokenLogoText}>
                  {activeToken?.symbol?.charAt(0) || 'S'}
                </Text>
              </View>
            )}
            <Text style={styles.selectorText}>{activeToken?.symbol || 'SOL'}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            <Text style={styles.selectorBalance}>
              Bal: {activeToken?.balance.toFixed(activeToken.isNative ? 4 : 2)}
            </Text>
          </PressableScale>

          {/* Recipient */}
          <Text style={styles.label}>Recipient Address</Text>
          <TextInput
            style={[
              styles.input,
              recipient.length > 0 && !isValidAddress(recipient) && styles.inputError,
            ]}
            placeholder="Solana wallet address"
            placeholderTextColor={colors.textMuted}
            value={recipient}
            onChangeText={setRecipient}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {recipient.length > 0 && recipient === walletAddress && (
            <Text style={styles.errorHint}>Cannot send to yourself</Text>
          )}

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <PressableScale onPress={handleMax} style={styles.maxButton}>
              <Text style={styles.maxText}>MAX</Text>
            </PressableScale>
          </View>
          {parsedAmount > maxAmount && (
            <Text style={styles.errorHint}>Insufficient balance</Text>
          )}

          {/* Review Button */}
          <PressableScale
            onPress={handleReview}
            disabled={!canSend}
            style={[styles.primaryButton, !canSend && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>
              Review Send
            </Text>
          </PressableScale>
        </View>

        {/* Review Step — confirmation before sending */}
        {step === 'review' && (
          <View style={styles.reviewOverlay}>
            <Text style={styles.reviewTitle}>Confirm Send</Text>

            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>To</Text>
                <Text style={styles.reviewValue} numberOfLines={1}>
                  {recipient.slice(0, 8)}...{recipient.slice(-6)}
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Amount</Text>
                <Text style={styles.reviewValue}>{amount} {activeToken?.symbol || 'SOL'}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Network Fee</Text>
                <Text style={styles.reviewValue}>~0.00025 SOL</Text>
              </View>
              <View style={[styles.reviewRow, styles.reviewTotal]}>
                <Text style={styles.reviewTotalLabel}>Total</Text>
                <Text style={styles.reviewTotalValue}>
                  {activeToken?.isNative
                    ? `~${(parsedAmount + 0.00025).toFixed(5)} SOL`
                    : `${amount} ${activeToken?.symbol} + ~0.00025 SOL`
                  }
                </Text>
              </View>
            </View>

            <View style={styles.reviewButtons}>
              <PressableScale
                onPress={() => setStep('form')}
                style={styles.reviewCancelBtn}
              >
                <Text style={styles.reviewCancelText}>Back</Text>
              </PressableScale>
              <PressableScale
                onPress={handleSend}
                style={[styles.primaryButton, { flex: 1 }]}
              >
                <Text style={styles.primaryButtonText}>Confirm Send</Text>
              </PressableScale>
            </View>
          </View>
        )}
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  label: {
    ...typography.micro,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  // Token selector
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
  },
  selectorLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  selectorText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  selectorBalance: {
    ...typography.micro,
    color: colors.textMuted,
  },
  // Input
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.textPrimary,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorHint: {
    ...typography.micro,
    color: colors.danger,
    marginTop: 4,
  },
  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountInput: {
    flex: 1,
  },
  maxButton: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  maxText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  // Button
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },
  // Success
  successIcon: {
    marginBottom: spacing.sm,
  },
  sigText: {
    ...typography.micro,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
    maxWidth: '80%',
    textAlign: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    maxWidth: '80%',
  },
  // Token picker
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tokenList: {
    flex: 1,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: borderRadius.md,
    marginBottom: 4,
  },
  tokenRowActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  tokenLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  tokenLogoPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenLogoText: {
    ...typography.bodyBold,
    color: colors.textMuted,
    fontSize: 14,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  tokenName: {
    ...typography.micro,
    color: colors.textMuted,
  },
  tokenBalance: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  reviewOverlay: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  reviewTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reviewValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  reviewTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  reviewTotalLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  reviewTotalValue: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  reviewButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reviewCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewCancelText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
});
