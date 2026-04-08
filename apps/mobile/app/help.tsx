/**
 * Help & Support Screen — FAQ + contact channels
 * Accessible from Profile > Settings > Help & Support
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
import { PressableScale } from '../src/components';
import { colors, spacing, borderRadius, typography } from '../src/theme';

// ─── FAQ Data ───────────────────────────────────────────────────────

type FAQItem = { q: string; a: string };

const faqs: FAQItem[] = [
  {
    q: 'What is PNL?',
    a: 'PNL (Predict & Launch) is a Solana-based prediction market where you vote on whether a token idea will succeed. If the community votes YES, the token launches automatically via Pump.fun. Think of it as Kickstarter meets prediction markets — for crypto.',
  },
  {
    q: 'How do prediction markets work?',
    a: 'Each market has two sides: YES (will succeed) and NO (will fail). You vote with SOL — minimum 0.01 SOL. Prices update in real-time using an LMSR bonding curve. When the market expires, the winning side gets rewarded.',
  },
  {
    q: 'What happens when YES wins?',
    a: 'The token launches automatically on Pump.fun. YES voters receive 65% of the launched tokens proportional to their shares. The founding team gets 33% (vested over 12 months) and PNL platform receives 2%.',
  },
  {
    q: 'What happens when NO wins?',
    a: 'No token is launched. All participants (both YES and NO voters) receive a full refund of their SOL, minus the 1.5% trading fee that was charged at the time of voting.',
  },
  {
    q: 'What are the fees?',
    a: 'There are three fees:\n\n• Market creation: 0.015 SOL (one-time)\n• Trade fee: 1.5% on each vote\n• Completion fee: 5% of the total pool when a market resolves\n\nNo completion fee is charged on refunds.',
  },
  {
    q: 'What is the minimum vote amount?',
    a: 'The minimum vote is 0.01 SOL (roughly ~$2). This is enforced by the smart contract and keeps the platform accessible to everyone.',
  },
  {
    q: 'How do I claim my rewards?',
    a: 'After a market resolves, go to the market page and tap "Claim". If YES won, you\'ll receive tokens. If NO won or the market refunded, you\'ll receive SOL back. You can only claim once per market.',
  },
  {
    q: 'Can I vote both YES and NO?',
    a: 'No. Each wallet can only hold one position per market — either YES or NO. You must choose a side. You can add more SOL to your existing position at any time.',
  },
  {
    q: 'How does reputation work?',
    a: 'Your reputation score is based on your prediction accuracy, number of markets participated in, and successful projects created. Higher reputation builds community trust and visibility.',
  },
  {
    q: 'Is PNL safe to use?',
    a: 'PNL runs on audited Solana smart contracts with atomic execution (Jito bundling) — token launches either fully succeed or fully revert. All market funds are held in on-chain Program Derived Addresses (PDAs), not by the team.',
  },
];

// ─── Quick Links ────────────────────────────────────────────────────

const quickLinks = [
  {
    icon: 'cart-outline' as const,
    label: 'How to Buy $PNL',
    color: '#22d3ee',
    onPress: () => router.push('/how-to-buy'),
  },
  {
    icon: 'document-text-outline' as const,
    label: 'Read the Whitepaper',
    color: '#818cf8',
    onPress: () => router.push('/whitepaper'),
  },
  {
    icon: 'lock-closed-outline' as const,
    label: 'Terms of Service',
    color: '#fbbf24',
    onPress: () => Linking.openURL('https://pnl.market/terms'),
  },
  {
    icon: 'shield-checkmark-outline' as const,
    label: 'Privacy Policy',
    color: '#34d399',
    onPress: () => Linking.openURL('https://pnl.market/privacy'),
  },
];

// ─── FAQ Accordion ──────────────────────────────────────────────────

function FAQRow({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={s.faqItem}>
      <PressableScale onPress={() => setOpen(!open)} style={s.faqQuestion}>
        <Text style={s.faqQuestionText}>{item.q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </PressableScale>
      {open && (
        <Text style={s.faqAnswer}>{item.a}</Text>
      )}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────

export default function HelpScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </PressableScale>
        <Text style={s.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Ionicons name="help-buoy-outline" size={40} color={colors.primary} />
          <Text style={s.heroTitle}>How can we help?</Text>
          <Text style={s.heroSubtitle}>
            Find answers below or reach out to our community
          </Text>
        </View>

        {/* Contact cards */}
        <Text style={s.sectionTitle}>Get in Touch</Text>
        <View style={s.contactRow}>
          <PressableScale
            onPress={() => Linking.openURL('https://discord.gg/38pkg4vm')}
            style={[s.contactCard, { borderColor: 'rgba(129, 140, 248, 0.3)' }]}
          >
            <View style={[s.contactIconWrap, { backgroundColor: 'rgba(129, 140, 248, 0.15)' }]}>
              <Ionicons name="logo-discord" size={24} color="#818cf8" />
            </View>
            <Text style={s.contactLabel}>Discord</Text>
            <Text style={s.contactHint}>Join community</Text>
          </PressableScale>

          <PressableScale
            onPress={() => Linking.openURL('https://x.com/pnldotmarket')}
            style={[s.contactCard, { borderColor: 'rgba(255, 255, 255, 0.15)' }]}
          >
            <View style={[s.contactIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
              <Ionicons name="logo-twitter" size={24} color="#f9fafb" />
            </View>
            <Text style={s.contactLabel}>X (Twitter)</Text>
            <Text style={s.contactHint}>@pnldotmarket</Text>
          </PressableScale>
        </View>

        {/* FAQ */}
        <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
        <View style={s.faqList}>
          {faqs.map((item, i) => (
            <FAQRow key={i} item={item} />
          ))}
        </View>

        {/* Quick links */}
        <Text style={s.sectionTitle}>Quick Links</Text>
        <View style={s.linksList}>
          {quickLinks.map((link, i) => (
            <PressableScale key={i} onPress={link.onPress} style={s.linkRow}>
              <Ionicons name={link.icon} size={20} color={link.color} />
              <Text style={s.linkLabel}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </PressableScale>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Still need help? Our Discord community is the fastest way to get support. We're here to help!
          </Text>
          <PressableScale
            onPress={() => Linking.openURL('https://discord.gg/38pkg4vm')}
            style={s.footerBtn}
          >
            <Ionicons name="logo-discord" size={18} color="#fff" />
            <Text style={s.footerBtnText}>Join Discord</Text>
          </PressableScale>
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
    paddingTop: spacing.lg,
  },
  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  // Section title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    marginTop: 4,
  },
  // Contact cards
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  contactCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  contactIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  contactHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // FAQ
  faqList: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 28,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 21,
    color: '#9ca3af',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  // Quick links
  linksList: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 28,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  linkLabel: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  // Footer
  footer: {
    alignItems: 'center',
    padding: 20,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
    gap: 14,
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9ca3af',
    textAlign: 'center',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5865F2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
