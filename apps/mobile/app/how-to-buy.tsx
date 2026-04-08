/**
 * How to Buy Screen — Native rendering matching web's pnl.market/how-to-buy
 * Accessible from Profile > Footer > How to Buy
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '../src/components';
import { colors, spacing, borderRadius, typography } from '../src/theme';

const PNL_CONTRACT = '6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump';

// ─── Color themes per platform ──────────────────────────────────────
const colorThemes = {
  purple: {
    bg: 'rgba(147, 51, 234, 0.1)',
    border: 'rgba(147, 51, 234, 0.2)',
    text: '#c084fc',
    stepBg: '#9333ea',
    badge: 'rgba(147, 51, 234, 0.2)',
    badgeText: '#d8b4fe',
  },
  green: {
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.2)',
    text: '#4ade80',
    stepBg: '#22c55e',
    badge: 'rgba(34, 197, 94, 0.2)',
    badgeText: '#86efac',
  },
  blue: {
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.2)',
    text: '#60a5fa',
    stepBg: '#3b82f6',
    badge: 'rgba(59, 130, 246, 0.2)',
    badgeText: '#93c5fd',
  },
} as const;

// ─── Platform data ──────────────────────────────────────────────────

type Platform = {
  name: string;
  subtitle: string;
  color: keyof typeof colorThemes;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  steps: { title: string; description: string; hasCopyAddress?: boolean }[];
  link: string;
  linkText: string;
};

const platforms: Platform[] = [
  {
    name: 'Phantom Wallet',
    subtitle: "Start here — you'll need this for all methods",
    color: 'purple',
    iconName: 'wallet',
    iconColor: '#9333ea',
    steps: [
      {
        title: 'Download Phantom',
        description:
          'Get Phantom from the App Store (iOS) or Google Play (Android). You can also install the browser extension from phantom.app.',
      },
      {
        title: 'Set Up Your Wallet',
        description:
          'Open Phantom and sign up using your email. Your wallet will be created automatically. Save your recovery phrase somewhere safe.',
      },
      {
        title: 'Copy Your Solana Receiving Address',
        description:
          "Tap \"Receive\" and select Solana. Copy this address — you'll use it to receive SOL or PNL from exchanges like Robinhood or Coinbase.",
      },
    ],
    link: 'https://phantom.app',
    linkText: 'Get Phantom',
  },
  {
    name: 'Buy Directly in Phantom',
    subtitle: 'Buy SOL with card, swap to PNL — no exchange needed',
    color: 'purple',
    iconName: 'swap-horizontal',
    iconColor: '#9333ea',
    steps: [
      {
        title: 'Tap "Buy" in Phantom',
        description:
          'Open Phantom and tap the "Buy" button. Select Solana (SOL) and enter the amount you want to purchase.',
      },
      {
        title: 'Continue with Email',
        description:
          "Tap \"Continue\" and you'll be taken to MoonPay. Enter your email address to get started.",
      },
      {
        title: 'Complete KYC Verification',
        description:
          "MoonPay will ask you to verify your identity — upload a government-issued ID and take a quick selfie. This is a one-time step, you won't need to do it again for future purchases.",
      },
      {
        title: 'Enter Payment & Buy SOL',
        description:
          "Once verified, you'll be taken back to the purchase screen. Enter your card details, confirm the amount, and complete the purchase. Your SOL will arrive in Phantom shortly.",
      },
      {
        title: 'Tap the Swap Button',
        description:
          'Once your SOL arrives in Phantom, tap the Swap button (two arrows icon) at the bottom of the screen.',
      },
      {
        title: 'Swap SOL → PNL',
        description:
          'Set SOL as the "from" token. For the "to" token, paste the PNL contract address below. Enter your amount, confirm the swap, and you\'re done! PNL will appear in your wallet within seconds.',
        hasCopyAddress: true,
      },
    ],
    link: 'https://phantom.app',
    linkText: 'Open Phantom',
  },
  {
    name: 'Robinhood',
    subtitle: 'Buy SOL, send to Phantom, swap for PNL',
    color: 'green',
    iconName: 'trending-up',
    iconColor: '#22c55e',
    steps: [
      {
        title: 'Deposit Money on Robinhood',
        description:
          'Open Robinhood and deposit funds. Robinhood offers instant settlement, so your money is available to trade right away.',
      },
      {
        title: 'Buy Solana (SOL)',
        description:
          'Search for Solana (SOL) on Robinhood and buy however much you want to convert to PNL.',
      },
      {
        title: 'Go to Transfer → Send',
        description:
          "Tap on your SOL holding, then tap \"Transfer\" → \"Send\". If this is your first time sending crypto from Robinhood, you'll need to set up your crypto wallet first.",
      },
      {
        title: '(First Time Only) Verify Your Identity',
        description:
          "Robinhood will ask you to enable crypto transfers. You'll need to verify your identity — confirm your personal details, enter your two-factor authentication code, and agree to the transfer terms. This is a one-time setup.",
      },
      {
        title: 'Paste Phantom Address & Send SOL',
        description:
          'Once verified, paste your Phantom Solana receiving address (from Step 3 above), enter the amount of SOL to send, review the details, and confirm the transfer.',
      },
      {
        title: 'Swap SOL for PNL in Phantom',
        description:
          'Once your SOL arrives in Phantom, tap the Swap button. Set SOL as the "from" token. For the "to" token, paste the PNL contract address below. Enter your amount, confirm the swap, and you\'re all set!',
        hasCopyAddress: true,
      },
    ],
    link: 'https://robinhood.com',
    linkText: 'Open Robinhood',
  },
  {
    name: 'Coinbase',
    subtitle: 'Buy PNL directly with contract address',
    color: 'blue',
    iconName: 'logo-usd',
    iconColor: '#3b82f6',
    steps: [
      {
        title: 'Open Coinbase & Search by Contract Address',
        description:
          'Open the Coinbase app or go to coinbase.com. In the search bar, paste the PNL contract address below. This will take you directly to the $PNL token.',
        hasCopyAddress: true,
      },
      {
        title: 'Buy PNL',
        description:
          'Tap "Buy", enter how much you want in USD or token amount, review the details, and confirm. Your PNL will appear in your Coinbase wallet right away.',
      },
      {
        title: '(Optional) Send to Phantom to HODL',
        description:
          'If you want to hold your PNL in Phantom, go to your PNL balance on Coinbase, tap "Send", paste your Phantom Solana receiving address, and confirm the transfer.',
      },
    ],
    link: 'https://www.coinbase.com',
    linkText: 'Open Coinbase',
  },
];

// ─── Copyable Address Component ─────────────────────────────────────

function CopyableAddress() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(PNL_CONTRACT);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <PressableScale onPress={handleCopy} style={s.copyAddress}>
      <Text style={s.copyAddressText} numberOfLines={1}>
        {PNL_CONTRACT}
      </Text>
      <Ionicons
        name={copied ? 'checkmark' : 'copy-outline'}
        size={14}
        color={copied ? '#4ade80' : 'rgba(255,255,255,0.5)'}
      />
    </PressableScale>
  );
}

// ─── Platform Section ───────────────────────────────────────────────

function PlatformSection({ platform, defaultOpen }: { platform: Platform; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const theme = colorThemes[platform.color];

  return (
    <View style={[s.platformCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      {/* Header */}
      <PressableScale
        onPress={() => setIsOpen(!isOpen)}
        style={s.platformHeader}
      >
        <View style={s.platformHeaderLeft}>
          <View style={[s.platformIcon, { backgroundColor: `${platform.iconColor}20` }]}>
            <Ionicons name={platform.iconName} size={22} color={platform.iconColor} />
          </View>
          <View style={s.platformInfo}>
            <Text style={s.platformName}>{platform.name}</Text>
            <Text style={[s.platformSubtitle, { color: theme.text }]}>
              {platform.subtitle}
            </Text>
          </View>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </PressableScale>

      {/* Expanded steps */}
      {isOpen && (
        <View style={s.stepsContainer}>
          <View style={s.stepsDivider} />

          {platform.steps.map((step, index) => (
            <View key={index} style={s.stepRow}>
              <View style={[s.stepNumber, { backgroundColor: theme.stepBg }]}>
                <Text style={s.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={s.stepContent}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDescription}>{step.description}</Text>
                {step.hasCopyAddress && (
                  <View style={s.stepCopyContainer}>
                    <CopyableAddress />
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* External link button */}
          <PressableScale
            onPress={() => Linking.openURL(platform.link)}
            style={[s.platformLink, { backgroundColor: theme.badge }]}
          >
            <Text style={[s.platformLinkText, { color: theme.badgeText }]}>
              {platform.linkText}
            </Text>
            <Ionicons name="open-outline" size={14} color={theme.badgeText} />
          </PressableScale>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────

export default function HowToBuyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      {/* Header bar */}
      <View style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </PressableScale>
        <Text style={s.headerTitle}>How to Buy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={s.titleSection}>
          <Text style={s.mainTitle}>
            How to Buy <Text style={s.titleAccent}>$PNL</Text>
          </Text>
          <View style={s.caRow}>
            <Text style={s.caLabel}>CA:</Text>
            <CopyableAddress />
          </View>
        </View>

        {/* Tip banner */}
        <View style={s.tipBanner}>
          <Text style={s.tipText}>
            <Text style={s.tipHighlight}>First things first: </Text>
            Download Phantom wallet — you'll need it no matter which method you choose. You can buy SOL directly in Phantom with a card, or use Robinhood / Coinbase.
          </Text>
        </View>

        {/* Platform sections */}
        {platforms.map((platform, index) => (
          <PlatformSection
            key={platform.name}
            platform={platform}
            defaultOpen={index === 0}
          />
        ))}

        {/* Bottom CA repeat */}
        <View style={s.bottomCa}>
          <View style={s.caRow}>
            <Text style={s.caLabel}>CA:</Text>
            <CopyableAddress />
          </View>
        </View>

        {/* Footer note */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Need help? Join our{' '}
            <Text
              style={s.footerLink}
              onPress={() => Linking.openURL('https://discord.gg/38pkg4vm')}
            >
              Discord community
            </Text>{' '}
            and we'll walk you through it.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
    fontSize: 17,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  // Title
  titleSection: {
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  titleAccent: {
    color: '#22d3ee',
  },
  caRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  caLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Tip banner
  tipBanner: {
    padding: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.2)',
    marginBottom: 16,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#d1d5db',
  },
  tipHighlight: {
    fontWeight: '700',
    color: '#22d3ee',
  },
  // Platform cards
  platformCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  platformHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformInfo: {
    flex: 1,
  },
  platformName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  platformSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // Steps
  stepsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stepsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9ca3af',
  },
  stepCopyContainer: {
    marginTop: 8,
  },
  // Copy address
  copyAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyAddressText: {
    fontSize: 11,
    fontFamily: 'monospace' as any,
    color: '#22d3ee',
    maxWidth: 200,
  },
  // Platform link button
  platformLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  platformLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Bottom CA
  bottomCa: {
    marginTop: 8,
    marginBottom: 4,
  },
  // Footer
  footer: {
    marginTop: 16,
    padding: 16,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  footerText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLink: {
    color: '#818cf8',
    textDecorationLine: 'underline',
  },
});
