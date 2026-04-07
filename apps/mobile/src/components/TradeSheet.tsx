/**
 * TradeSheet — Pump.fun-style Jupiter swap bottom sheet for launched tokens.
 * Replaces inline TokenTrading card with a sheet triggered from sticky buy/sell buttons.
 * Pattern: forwardRef<GorhomBottomSheet> like VoteBottomSheet.
 */

import React, { forwardRef, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import GorhomBottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { parseError } from '@pnl/shared/utils';
import { useAuth } from '../providers/AuthProvider';
import { useNetwork } from '@pnl/shared/hooks';
import { getSolanaConnection } from '@pnl/shared/solana';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './PressableScale';
import { colors, spacing, typography, borderRadius } from '../theme';

interface TradeSheetProps {
  tokenMint: string;
  tokenSymbol: string;
  initialMode: 'buy' | 'sell';
  onClose?: () => void;
}

interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_API_KEY = '5b7cc211-4f7d-4453-8ada-21e76c406d7e';
const BUY_CHIPS = [0.01, 0.1, 0.5];
const SELL_CHIPS = [25, 50, 100]; // percentages

export const TradeSheet = forwardRef<GorhomBottomSheet, TradeSheetProps>(
  ({ tokenMint, tokenSymbol, initialMode, onClose }, ref) => {
    const { isAuthenticated, walletAddress, solanaWallet } = useAuth();
    const { network } = useNetwork();
    const isMainnet = network === 'mainnet-beta';

    const [isBuyMode, setIsBuyMode] = useState(initialMode === 'buy');
    const [inputAmount, setInputAmount] = useState('');
    const [outputAmount, setOutputAmount] = useState('');
    const [quote, setQuote] = useState<QuoteResponse | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [slippageBps, setSlippageBps] = useState(100); // 1% default
    const [solBalance, setSolBalance] = useState<number>(0);
    const [tokenBalance, setTokenBalance] = useState<number>(0);
    const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync initialMode when sheet opens
    useEffect(() => {
      setIsBuyMode(initialMode === 'buy');
      setInputAmount('');
      setOutputAmount('');
      setQuote(null);
      setError(null);
    }, [initialMode]);

    // Fetch balances
    const fetchBalances = useCallback(async () => {
      if (!walletAddress) return;
      try {
        const connection = await getSolanaConnection();
        const pubkey = new PublicKey(walletAddress);

        const solLamports = await connection.getBalance(pubkey);
        setSolBalance(solLamports / 1e9);

        try {
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
            mint: new PublicKey(tokenMint),
          });
          if (tokenAccounts.value.length > 0) {
            setTokenBalance(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0);
          } else {
            setTokenBalance(0);
          }
        } catch {
          setTokenBalance(0);
        }
      } catch (err) {
        // Silently handle balance fetch errors
      }
    }, [walletAddress, tokenMint]);

    useEffect(() => {
      if (walletAddress && isMainnet) fetchBalances();
    }, [walletAddress, isMainnet, fetchBalances]);

    // Get Jupiter quote (debounced)
    const getQuote = useCallback(async (amount: string) => {
      if (!amount || parseFloat(amount) <= 0) {
        setOutputAmount('');
        setQuote(null);
        return;
      }

      const inputMintAddr = isBuyMode ? SOL_MINT : tokenMint;
      const outputMintAddr = isBuyMode ? tokenMint : SOL_MINT;
      const inputDecimals = isBuyMode ? 9 : 6;

      try {
        setIsLoadingQuote(true);
        setError(null);

        const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, inputDecimals));
        const res = await fetch(
          `https://api.jup.ag/swap/v1/quote?inputMint=${inputMintAddr}&outputMint=${outputMintAddr}&amount=${amountInSmallestUnit}&slippageBps=${slippageBps}`,
          { headers: { 'Accept': 'application/json', 'x-api-key': JUPITER_API_KEY } },
        );

        if (!res.ok) throw new Error(`Jupiter API error: ${res.status}`);

        const data = await res.json();
        if (!data || !data.outAmount) throw new Error('No route found for this swap');

        setQuote(data);
        const outputDecimals = isBuyMode ? 6 : 9;
        const output = parseInt(data.outAmount) / Math.pow(10, outputDecimals);
        setOutputAmount(output.toFixed(Math.min(outputDecimals, 6)));
      } catch (err: any) {
        setError(err.message || 'Failed to fetch quote');
        setOutputAmount('');
      } finally {
        setIsLoadingQuote(false);
      }
    }, [isBuyMode, tokenMint]);

    // Debounce input changes
    useEffect(() => {
      if (!isMainnet) {
        setError('Trading available on mainnet only');
        return;
      }

      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
      quoteTimerRef.current = setTimeout(() => {
        if (inputAmount) getQuote(inputAmount);
      }, 500);

      return () => { if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current); };
    }, [inputAmount, isBuyMode, isMainnet, getQuote]);

    // Execute swap
    const handleSwap = useCallback(async () => {
      if (!quote || !walletAddress || !solanaWallet) return;

      try {
        setIsSwapping(true);
        setError(null);

        const swapRes = await fetch('https://api.jup.ag/swap/v1/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': JUPITER_API_KEY },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: walletAddress,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
          }),
        });

        if (!swapRes.ok) throw new Error('Failed to get swap transaction');

        const { swapTransaction } = await swapRes.json();
        const txBytes = Buffer.from(swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(txBytes);

        const provider = await solanaWallet.wallets![0].getProvider();
        const connection = await getSolanaConnection();
        const { signature } = await (provider as any).request({
          method: 'signAndSendTransaction',
          params: { transaction, connection },
        });
        await connection.confirmTransaction(signature, 'confirmed');

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Swap Successful', `Transaction: ${signature.slice(0, 8)}...`);

        setInputAmount('');
        setOutputAmount('');
        setQuote(null);
        fetchBalances();
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const parsed = parseError(err);
        setError(parsed.message);
      } finally {
        setIsSwapping(false);
      }
    }, [quote, walletAddress, solanaWallet, fetchBalances]);

    // Toggle buy/sell
    const toggleMode = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsBuyMode(prev => !prev);
      setInputAmount('');
      setOutputAmount('');
      setQuote(null);
      setError(null);
    }, []);

    // Quick chip handlers
    const handleBuyChip = useCallback((sol: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInputAmount(sol.toString());
    }, []);

    const handleSellChip = useCallback((pct: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (pct === 100) {
        setInputAmount(tokenBalance.toString());
      } else {
        const amt = tokenBalance * (pct / 100);
        setInputAmount(amt > 0 ? amt.toFixed(2) : '0');
      }
    }, [tokenBalance]);

    const priceImpact = quote ? parseFloat(quote.priceImpactPct) || 0 : 0;
    const canSwap = isMainnet && !!quote && !isSwapping && !isLoadingQuote && !!inputAmount && parseFloat(inputAmount) > 0 && isAuthenticated;
    const paySymbol = isBuyMode ? 'SOL' : tokenSymbol;
    const receiveSymbol = isBuyMode ? tokenSymbol : 'SOL';
    const payBalance = isBuyMode ? solBalance : tokenBalance;

    return (
      <BottomSheet ref={ref} snapPoints={['70%']} onClose={onClose}>
        <View style={styles.container}>

          {/* Buy / Sell toggle */}
          <View style={styles.toggleRow}>
            <PressableScale
              onPress={() => { if (!isBuyMode) toggleMode(); }}
              style={[styles.toggleBtn, isBuyMode && styles.toggleBuyActive]}
            >
              <Text style={[styles.toggleText, isBuyMode && styles.toggleBuyText]}>Buy</Text>
            </PressableScale>
            <PressableScale
              onPress={() => { if (isBuyMode) toggleMode(); }}
              style={[styles.toggleBtn, !isBuyMode && styles.toggleSellActive]}
            >
              <Text style={[styles.toggleText, !isBuyMode && styles.toggleSellText]}>Sell</Text>
            </PressableScale>
          </View>

          {/* Pair display */}
          <View style={styles.pairRow}>
            <Text style={styles.pairToken}>{paySymbol}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            <Text style={styles.pairToken}>{receiveSymbol}</Text>
          </View>

          {/* Mainnet warning */}
          {!isMainnet && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={14} color="#eab308" />
              <Text style={styles.warningText}>Trading available on mainnet only</Text>
            </View>
          )}

          {/* Large amount display */}
          <View style={styles.amountDisplay}>
            <BottomSheetTextInput
              style={styles.amountInput}
              value={inputAmount}
              onChangeText={setInputAmount}
              placeholder={`0 ${paySymbol}`}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              editable={isMainnet && !isSwapping}
            />
            {isLoadingQuote ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />
            ) : outputAmount ? (
              <Text style={styles.outputPreview}>~ {outputAmount} {receiveSymbol}</Text>
            ) : null}
          </View>

          {/* Quick amount chips */}
          <View style={styles.chipRow}>
            {isBuyMode ? (
              <>
                {BUY_CHIPS.map(amt => (
                  <PressableScale
                    key={amt}
                    onPress={() => handleBuyChip(amt)}
                    style={[styles.chip, inputAmount === amt.toString() && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, inputAmount === amt.toString() && styles.chipTextActive]}>
                      {amt} SOL
                    </Text>
                  </PressableScale>
                ))}
                <PressableScale
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const max = Math.max(0, solBalance - 0.01);
                    setInputAmount(max > 0 ? max.toFixed(4) : '0');
                  }}
                  style={[styles.chip]}
                >
                  <Text style={styles.chipText}>Max</Text>
                </PressableScale>
              </>
            ) : (
              <>
                {SELL_CHIPS.map(pct => (
                  <PressableScale
                    key={pct}
                    onPress={() => handleSellChip(pct)}
                    style={[styles.chip]}
                  >
                    <Text style={styles.chipText}>{pct}%</Text>
                  </PressableScale>
                ))}
                <PressableScale
                  onPress={() => handleSellChip(100)}
                  style={[styles.chip]}
                >
                  <Text style={styles.chipText}>Max</Text>
                </PressableScale>
              </>
            )}
          </View>

          {/* Balance */}
          <Text style={styles.balanceText}>
            Balance: {payBalance.toFixed(4)} {paySymbol}
          </Text>

          {/* Price impact */}
          {quote && outputAmount && inputAmount ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Price Impact</Text>
              <Text style={[styles.infoValue, priceImpact > 1 && styles.infoValueDanger]}>
                {priceImpact.toFixed(2)}%
              </Text>
            </View>
          ) : null}

          {/* Slippage selector */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Max Slippage</Text>
            <View style={styles.slippageRow}>
              {[50, 100, 200, 500].map((bps) => (
                <Pressable
                  key={bps}
                  onPress={() => { setSlippageBps(bps); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[styles.slippageChip, slippageBps === bps && styles.slippageChipActive]}
                >
                  <Text style={[styles.slippageChipText, slippageBps === bps && styles.slippageChipTextActive]}>
                    {(bps / 100).toFixed(1)}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Error */}
          {error && isMainnet ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit button */}
          <PressableScale
            onPress={handleSwap}
            disabled={!canSwap}
            style={[
              styles.submitBtn,
              isBuyMode ? styles.submitBuy : styles.submitSell,
              !canSwap && styles.submitDisabled,
            ]}
          >
            {isSwapping ? (
              <ActivityIndicator size="small" color={isBuyMode ? '#065f46' : '#7f1d1d'} />
            ) : (
              <Text style={[styles.submitText, isBuyMode ? styles.submitTextBuy : styles.submitTextSell]}>
                {isBuyMode ? 'Buy' : 'Sell'} {tokenSymbol}
              </Text>
            )}
          </PressableScale>

          {/* Footer */}
          <Text style={styles.footer}>Powered by Jupiter Aggregator</Text>
        </View>
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  toggleBuyActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  toggleSellActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  toggleText: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  toggleBuyText: { color: '#22c55e' },
  toggleSellText: { color: '#ef4444' },

  // Pair
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pairToken: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },

  // Warning
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(234,179,8,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  warningText: { fontSize: 11, color: '#eab308' },

  // Amount
  amountDisplay: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
  },
  outputPreview: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: 'rgba(129,140,248,0.15)',
    borderColor: 'rgba(129,140,248,0.3)',
  },
  chipText: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.primary,
  },

  // Balance
  balanceText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoLabel: { ...typography.micro, color: colors.textMuted },
  infoValue: { ...typography.micro, fontWeight: '600', color: '#10b981' },
  infoValueDanger: { color: '#ef4444' },

  // Error
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  errorText: { fontSize: 11, color: '#ef4444' },

  // Submit
  submitBtn: {
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBuy: { backgroundColor: '#86efac' },
  submitSell: { backgroundColor: '#fca5a5' },
  submitDisabled: { opacity: 0.4 },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
  submitTextBuy: { color: '#065f46' },
  submitTextSell: { color: '#7f1d1d' },

  // Footer
  footer: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'center',
  },
  slippageRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slippageChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  slippageChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(129,140,248,0.12)',
  },
  slippageChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  slippageChipTextActive: {
    color: colors.primary,
  },
});
