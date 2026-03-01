/**
 * Whitepaper Screen — Native rendering matching web's pnl.market/whitepaper
 * Accessible from Profile > Settings > Whitepaper
 */

import { useRef, useState, useCallback } from 'react';
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

// ─── Table of contents ─────────────────────────────────────────────

const TOC = [
  { id: 'abstract', title: 'Abstract' },
  { id: 'problem', title: 'The Problem' },
  { id: 'solution', title: 'The Solution' },
  { id: 'how', title: 'How PNL Works' },
  { id: 'benefits', title: 'Why Build & Invest' },
  { id: 'economics', title: 'Economics' },
  { id: 'vision', title: 'Vision' },
  { id: 'technical', title: 'Technical Architecture' },
  { id: 'community', title: 'Join the Revolution' },
];

// ─── Reusable primitives ───────────────────────────────────────────

function H2({ children }: { children: string }) {
  return <Text style={s.h2}>{children}</Text>;
}
function H3({ children, color }: { children: string; color?: string }) {
  return <Text style={[s.h3, color ? { color } : null]}>{children}</Text>;
}
function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}
function B({ children }: { children: string }) {
  return <Text style={s.bold}>{children}</Text>;
}
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}
function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <Text style={[s.bulletDot, { color: '#22c55e' }]}>✅</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}
function CodeBlock({ children }: { children: string }) {
  return (
    <View style={s.codeBlock}>
      <Text style={s.codeText}>{children}</Text>
    </View>
  );
}
function Divider() {
  return <View style={s.divider} />;
}
function HighlightBox({ children, borderColor }: { children: React.ReactNode; borderColor?: string }) {
  return (
    <View style={[s.highlightBox, borderColor ? { borderLeftColor: borderColor } : null]}>
      {children}
    </View>
  );
}
function ColorCard({
  title,
  subtitle,
  accentColor,
  children,
}: {
  title: string;
  subtitle?: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.colorCard, { borderColor: `${accentColor}40` }]}>
      <Text style={[s.colorCardTitle, { color: accentColor }]}>{title}</Text>
      {subtitle ? <Text style={s.colorCardSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

// ─── Step Card ─────────────────────────────────────────────────────

function StepCard({
  step,
  title,
  desc,
  detail,
  color,
}: {
  step: number;
  title: string;
  desc: string;
  detail: string;
  color: string;
}) {
  return (
    <View style={[s.stepCard, { borderColor: `${color}40` }]}>
      <View style={[s.stepBadge, { backgroundColor: color }]}>
        <Text style={s.stepBadgeText}>{step}</Text>
      </View>
      <Text style={[s.stepTitle, { color }]}>{title}</Text>
      <Text style={s.stepDesc}>{desc}</Text>
      <Text style={[s.stepDetail, { color }]}>{detail}</Text>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────

export default function WhitepaperScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [showTOC, setShowTOC] = useState(false);
  const sectionRefs = useRef<Record<string, number>>({});

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </PressableScale>
        <Text style={s.headerTitle}>Whitepaper</Text>
        <PressableScale onPress={() => setShowTOC(!showTOC)} style={s.headerBtn}>
          <Ionicons name={showTOC ? 'close' : 'list'} size={22} color={colors.textSecondary} />
        </PressableScale>
      </View>

      {/* TOC overlay */}
      {showTOC && (
        <View style={[s.tocOverlay, { paddingTop: insets.top + 80 }]}>
          <Text style={s.tocTitle}>Table of Contents</Text>
          {TOC.map((sec, i) => (
            <PressableScale
              key={sec.id}
              onPress={() => {
                setShowTOC(false);
                const y = sectionRefs.current[sec.id];
                if (y !== undefined) scrollRef.current?.scrollTo({ y: y - 80, animated: true });
              }}
              style={s.tocItem}
            >
              <Text style={s.tocNum}>{i + 1}.</Text>
              <Text style={s.tocText}>{sec.title}</Text>
            </PressableScale>
          ))}
        </View>
      )}

      {/* Content */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title ── */}
        <View style={s.titleBlock}>
          <Ionicons name="planet" size={40} color={colors.primary} />
          <Text style={s.mainTitle}>PNL Whitepaper</Text>
          <Text style={s.tagline}>Idea Tokenization: Where Dreamers Meet Believers</Text>
          <View style={s.metaRow}>
            <Text style={s.meta}>Version 1.0</Text>
            <View style={s.metaDot} />
            <Text style={s.meta}>December 2025</Text>
            <View style={s.metaDot} />
            <Text style={s.meta}>Solana Mainnet</Text>
          </View>
        </View>

        {/* Mission statement */}
        <View style={s.missionBox}>
          <Text style={s.missionText}>
            "Fueling the world's brilliant ideas — from anywhere, for everyone."
          </Text>
          <Text style={s.missionSub}>Yours could be next.</Text>
        </View>

        <Divider />

        {/* ── Abstract ── */}
        <View onLayout={(e) => { sectionRefs.current['abstract'] = e.nativeEvent.layout.y; }}>
          <H2>Abstract</H2>
          <P>
            <B>VC funding isn't accessible to everyone.</B> The traditional path to capital requires connections, geography, and credentials that most brilliant minds simply don't have. Every day, world-changing ideas die — not because they lack merit, but because their creators lack access.
          </P>
          <P>
            <B>PNL changes that.</B> Through <Text style={{ color: '#60a5fa' }}>Idea Tokenization</Text>, builders can transform their vision into something the world can fund. Supporters back ideas they believe in and receive tokens in return — becoming early stakeholders in projects they helped make real.
          </P>

          <HighlightBox>
            <CheckBullet><B>For Builders:</B> Raise capital from believers worldwide — no VCs required</CheckBullet>
            <CheckBullet><B>For Supporters:</B> Fund ideas you believe in, receive tokens in return</CheckBullet>
            <CheckBullet><B>Community Validated:</B> Prediction markets filter quality, believers back winners</CheckBullet>
            <CheckBullet><B>Global & Permissionless:</B> From anywhere, for everyone — 0.01 SOL minimum</CheckBullet>
            <CheckBullet><B>Discover Treasures:</B> Find the next breakthrough before the world does</CheckBullet>
          </HighlightBox>
        </View>

        <Divider />

        {/* ── The Problem ── */}
        <View onLayout={(e) => { sectionRefs.current['problem'] = e.nativeEvent.layout.y; }}>
          <H2>The Problem: Capital is Gatekept</H2>
          <P>
            You have a brilliant idea. You've done the research, built the prototype, and you know it can change the world. But you need capital to make it real.
          </P>
          <P>
            <Text style={{ color: '#ef4444' }}>VCs won't return your emails.</Text> They fund Stanford dropouts and YC alumni — not dreamers in Lagos, Manila, or São Paulo. Less than 1% of startups get funded. <B>The system is broken.</B>
          </P>

          {/* Problem cards */}
          <ColorCard title="VC Gatekeeping" accentColor="#ef4444">
            <Text style={s.cardBody}>Connections over merit. Geography over vision. Credentials over capability.</Text>
          </ColorCard>
          <ColorCard title="No Global Access" accentColor="#ef4444">
            <Text style={s.cardBody}>Brilliant builders worldwide locked out of capital that flows freely in Silicon Valley.</Text>
          </ColorCard>
          <ColorCard title="Ideas Die Daily" accentColor="#ef4444">
            <Text style={s.cardBody}>World-changing visions fade — not for lack of merit, but lack of access.</Text>
          </ColorCard>

          <HighlightBox borderColor="#60a5fa">
            <P>
              <B>Web3 offered hope.</B> Peer-to-peer funding without intermediaries. But there was a missing piece — what do supporters get in return? The answer? <B>Tokenize the idea. Give supporters ownership. Let the crowd become co-founders.</B>
            </P>
          </HighlightBox>
        </View>

        <Divider />

        {/* ── The Solution ── */}
        <View onLayout={(e) => { sectionRefs.current['solution'] = e.nativeEvent.layout.y; }}>
          <H2>The Solution: Idea Tokenization</H2>

          <HighlightBox borderColor="#22d3ee">
            <H3 color="#22d3ee">Core Insight</H3>
            <P>
              Prediction markets are the most accurate forecasting tools ever created. <B>PNL harnesses this collective intelligence to separate brilliant ideas from noise.</B>
            </P>
            <P>
              When real money is on the line, people do their homework. <Text style={{ color: '#22d3ee' }}>Critics</Text> are incentivized to find flaws, while <Text style={{ color: '#22c55e' }}>Early Supporters</Text> are rewarded for spotting winners.
            </P>
          </HighlightBox>

          <H3>How Idea Tokenization Works</H3>
          <Bullet><B>1.</B> Founder tokenizes their idea: Create a market for your vision</Bullet>
          <Bullet><B>2.</B> Community evaluates: Early Supporters back it, Critics challenge it</Bullet>
          <Bullet><B>3.</B> Price discovery: The market reveals true sentiment</Bullet>
          <Bullet><B>4.</B> Validation gate: Only ideas with majority support get tokenized</Bullet>
          <Bullet><B>5.</B> Presale rewards: Early Supporters receive 65% of tokens at launch</Bullet>

          <Text style={[s.p, { color: '#22c55e', fontWeight: '600', marginTop: spacing.sm }]}>
            Result: The world's best ideas rise to the top. Real treasures get discovered.
          </Text>
        </View>

        <Divider />

        {/* ── How PNL Works ── */}
        <View onLayout={(e) => { sectionRefs.current['how'] = e.nativeEvent.layout.y; }}>
          <H2>How PNL Works</H2>
          <Text style={s.centeredCaption}>The Journey: From Idea to Token</Text>

          {/* 4-step flow */}
          <View style={s.stepsGrid}>
            <StepCard step={1} title="Create" desc="Founder tokenizes their idea" detail="0.015 SOL" color="#3b82f6" />
            <StepCard step={2} title="Validate" desc="Community backs or challenges" detail="Min 0.01 SOL" color="#a855f7" />
            <StepCard step={3} title="Resolve" desc="Market decides outcome" detail="At expiry" color="#22c55e" />
            <StepCard step={4} title="Launch" desc="Token goes live on Pump.fun" detail="If YES wins" color="#eab308" />
          </View>

          {/* Outcomes */}
          <Text style={s.centeredCaption}>Three possible outcomes — each one fair.</Text>
          <View style={s.outcomesRow}>
            <View style={[s.outcomeCard, { borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
              <Text style={[s.outcomeTitle, { color: '#22c55e' }]}>YES Wins</Text>
              <Text style={s.outcomeDesc}>Token launches{'\n'}Supporters get 65%</Text>
            </View>
            <View style={[s.outcomeCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Text style={[s.outcomeTitle, { color: '#ef4444' }]}>NO Wins</Text>
              <Text style={s.outcomeDesc}>No launch{'\n'}Critics share 95%</Text>
            </View>
            <View style={[s.outcomeCard, { borderColor: 'rgba(234, 179, 8, 0.3)' }]}>
              <Text style={[s.outcomeTitle, { color: '#eab308' }]}>Tie</Text>
              <Text style={s.outcomeDesc}>Everyone gets{'\n'}98.5% refund</Text>
            </View>
          </View>

          {/* Token Distribution */}
          <Text style={s.centeredCaption}>Token Distribution</Text>
          <View style={s.statsGrid}>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: '#22c55e' }]}>65%</Text>
              <Text style={s.statLabel}>Early Supporters</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: '#60a5fa' }]}>33%</Text>
              <Text style={s.statLabel}>Founder (vested)</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: '#a855f7' }]}>2%</Text>
              <Text style={s.statLabel}>Platform</Text>
            </View>
          </View>
        </View>

        <Divider />

        {/* ── Benefits ── */}
        <View onLayout={(e) => { sectionRefs.current['benefits'] = e.nativeEvent.layout.y; }}>
          <H2>Why Build & Invest on PNL?</H2>

          <ColorCard title="For Founders & Dreamers" subtitle="Turn your vision into reality" accentColor="#3b82f6">
            <Bullet>🌍 <B>Global capital:</B> Raise from believers worldwide</Bullet>
            <Bullet>🚀 <B>Instant community:</B> Supporters become your first fans</Bullet>
            <Bullet>✅ <B>Validation:</B> Know your idea has market demand</Bullet>
            <Bullet>💰 <B>Fair deal:</B> Keep your equity, share tokens</Bullet>
            <Bullet>⚡ <B>Fast launch:</B> Go from idea to token in days</Bullet>
          </ColorCard>

          <ColorCard title="For Early Supporters" subtitle="Find treasures before the crowd" accentColor="#22c55e">
            <Bullet>💎 <B>Presale access:</B> Get tokens at ground floor</Bullet>
            <Bullet>🎯 <B>Due diligence pays:</B> Research → spot winners → profit</Bullet>
            <Bullet>📈 <B>65% allocation:</B> Majority of tokens go to believers</Bullet>
            <Bullet>🤝 <B>Direct connection:</B> Build relationships with founders</Bullet>
            <Bullet>🔮 <B>Shape the future:</B> Back ideas you believe in</Bullet>
          </ColorCard>

          <ColorCard title="For Critics" subtitle="Get paid to filter quality" accentColor="#ef4444">
            <Bullet>🔍 <B>Quality control:</B> Your skepticism protects the ecosystem</Bullet>
            <Bullet>💵 <B>Earn from flops:</B> When bad ideas fail, critics profit</Bullet>
            <Bullet>⚖️ <B>Balance the market:</B> Keep hype in check</Bullet>
            <Bullet>🛡️ <B>Protect others:</B> Your NO vote warns the community</Bullet>
            <Bullet>📊 <B>95% pool share:</B> Winners split the pot</Bullet>
          </ColorCard>
        </View>

        <Divider />

        {/* ── Economics ── */}
        <View onLayout={(e) => { sectionRefs.current['economics'] = e.nativeEvent.layout.y; }}>
          <H2>Economics: Fair by Design</H2>
          <P>
            Traditional fundraising is unfair. VCs get preferential terms, insider access, and early exits. <B>PNL flips this model entirely.</B> Everyone plays by the same rules.
          </P>

          {/* Comparison */}
          <View style={s.comparisonRow}>
            <View style={[s.comparisonCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Text style={[s.comparisonTitle, { color: '#ef4444' }]}>❌ VC-Backed</Text>
              <Bullet>VCs: 50-70% at $0.001</Bullet>
              <Bullet>Team: 15-25%</Bullet>
              <Bullet>Public: 5-10% at $0.10</Bullet>
              <Text style={[s.comparisonResult, { color: '#ef4444' }]}>→ 100x price gap</Text>
            </View>
            <View style={[s.comparisonCard, { borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
              <Text style={[s.comparisonTitle, { color: '#22c55e' }]}>✅ PNL</Text>
              <Bullet>Supporters: <B>65%</B></Bullet>
              <Bullet>Founder: <B>33%</B> (vested)</Bullet>
              <Bullet>Platform: <B>2%</B></Bullet>
              <Text style={[s.comparisonResult, { color: '#22c55e' }]}>→ Same price for all</Text>
            </View>
          </View>

          {/* Fee structure */}
          <H3>Fee Structure</H3>
          <View style={s.feeGrid}>
            <View style={s.feeRow}>
              <View>
                <Text style={[s.feeValue, { color: '#60a5fa' }]}>0.015 SOL</Text>
                <Text style={s.feeLabel}>To create</Text>
              </View>
              <Text style={s.feeNote}>Spam prevention</Text>
            </View>
            <View style={s.feeRow}>
              <View>
                <Text style={[s.feeValue, { color: '#a855f7' }]}>1.5%</Text>
                <Text style={s.feeLabel}>Per vote</Text>
              </View>
              <Text style={s.feeNote}>Platform revenue</Text>
            </View>
            <View style={[s.feeRow, { borderBottomWidth: 0 }]}>
              <View>
                <Text style={[s.feeValue, { color: '#10b981' }]}>5%</Text>
                <Text style={s.feeLabel}>At resolution</Text>
              </View>
              <Text style={s.feeNote}>Completion fee</Text>
            </View>
          </View>

          <P>
            When YES wins, up to 50 SOL goes to Pump.fun for token launch. Any excess goes to the founder (8% immediate, 92% vested over 12 months).
          </P>
        </View>

        <Divider />

        {/* ── Vision ── */}
        <View onLayout={(e) => { sectionRefs.current['vision'] = e.nativeEvent.layout.y; }}>
          <H2>Vision: Where We're Going</H2>
          <P>
            For too long, tokens and equity have been treated as different things. But what if they're the same — just evolved for the internet age? <B>PNL is pioneering Idea Tokenization</B> — where your vision becomes an asset the world can believe in.
          </P>

          <View style={s.comparisonRow}>
            <ColorCard title="Traditional VC: Broken" accentColor="#ef4444">
              <Text style={s.cardBody}>
                Less than 1% of startups get funded. Brilliant builders in Lagos, Manila, São Paulo — locked out.
              </Text>
            </ColorCard>
            <ColorCard title="PNL: Borderless" accentColor="#22c55e">
              <Text style={s.cardBody}>
                No rejection — every idea gets a fair shot. Build from anywhere, raise from everywhere.
              </Text>
            </ColorCard>
          </View>

          <H3>What's Live Now</H3>
          <View style={s.featureGrid}>
            <View style={s.featureChip}>
              <Text style={[s.featureChipText, { color: '#22c55e' }]}>Community Chat</Text>
              <Text style={s.featureChipDesc}>Real-time discussions</Text>
            </View>
            <View style={s.featureChip}>
              <Text style={[s.featureChipText, { color: '#22c55e' }]}>Voice Rooms</Text>
              <Text style={s.featureChipDesc}>Live audio spaces</Text>
            </View>
            <View style={s.featureChip}>
              <Text style={[s.featureChipText, { color: '#22c55e' }]}>AI Analysis</Text>
              <Text style={s.featureChipDesc}>Smart project scoring</Text>
            </View>
          </View>

          <H3>What's Coming Next</H3>
          <View style={s.featureGrid}>
            <View style={s.featureChip}>
              <Text style={[s.featureChipText, { color: '#f59e0b' }]}>Reputation System</Text>
              <Text style={s.featureChipDesc}>Track record & credibility</Text>
            </View>
            <View style={s.featureChip}>
              <Text style={[s.featureChipText, { color: '#22d3ee' }]}>Teams & Talent</Text>
              <Text style={s.featureChipDesc}>Find collaborators</Text>
            </View>
          </View>
        </View>

        <Divider />

        {/* ── Technical ── */}
        <View onLayout={(e) => { sectionRefs.current['technical'] = e.nativeEvent.layout.y; }}>
          <H2>Technical Architecture</H2>

          <View style={s.techGrid}>
            <View style={s.techRow}>
              <Text style={[s.techLabel, { color: '#60a5fa' }]}>Blockchain</Text>
              <Text style={s.techValue}>Solana (Anchor/Rust)</Text>
            </View>
            <View style={s.techRow}>
              <Text style={[s.techLabel, { color: '#a855f7' }]}>Frontend</Text>
              <Text style={s.techValue}>Next.js 14 + React Native</Text>
            </View>
            <View style={s.techRow}>
              <Text style={[s.techLabel, { color: '#22c55e' }]}>Infrastructure</Text>
              <Text style={s.techValue}>Helius RPC + Address Lookup Tables</Text>
            </View>
            <View style={[s.techRow, { borderBottomWidth: 0 }]}>
              <Text style={[s.techLabel, { color: '#eab308' }]}>Token Launch</Text>
              <Text style={s.techValue}>Pump.fun + PumpSwap graduation</Text>
            </View>
          </View>

          <H3>On-Chain Program Architecture</H3>
          <P>
            All funds are held in Program Derived Addresses (PDAs) controlled by the smart contract — not team wallets.
          </P>
          <CodeBlock>{`PDA Account Structure:
├── Market PDA — Stores market state
├── Market Vault PDA — Holds SOL during voting
├── Position PDA — Tracks user shares (1 per user)
├── Treasury PDA — Collects platform fees
├── Team Vesting PDA — 25% token lockup (12mo)
└── Founder Vesting PDA — Excess SOL lockup`}</CodeBlock>

          <H3>Atomic Token Launch</H3>
          <P>
            When YES wins, token creation and distribution happen in a single atomic transaction. No intermediary steps where funds could be lost.
          </P>
          <CodeBlock>{`Single Transaction Flow:
1. Create token on Pump.fun (via CPI)
2. Create market's Associated Token Account
3. Buy tokens with pool SOL (up to 50 SOL)
4. Deduct 5% completion fee to Treasury
5. Set allocations (65% YES / 33% Team / 2% Platform)
6. Mark market as resolved
✓ All-or-nothing execution`}</CodeBlock>

          <H3>Security Features</H3>
          <View style={s.securityGrid}>
            <View style={s.securityCard}>
              <Text style={s.securityTitle}>One Position Per Wallet</Text>
              <Text style={s.securityDesc}>Cannot bet YES and NO — prevents manipulation.</Text>
            </View>
            <View style={s.securityCard}>
              <Text style={s.securityTitle}>Permissionless Resolution</Text>
              <Text style={s.securityDesc}>Anyone can resolve after expiry — no single point of failure.</Text>
            </View>
            <View style={s.securityCard}>
              <Text style={s.securityTitle}>Vested Distribution</Text>
              <Text style={s.securityDesc}>Team tokens vest over 12 months — long-term alignment.</Text>
            </View>
            <View style={s.securityCard}>
              <Text style={s.securityTitle}>Rent Recovery</Text>
              <Text style={s.securityDesc}>Closed accounts return rent — no locked SOL.</Text>
            </View>
          </View>

          <View style={s.programId}>
            <Text style={s.programIdLabel}>Program ID</Text>
            <Text style={s.programIdValue} selectable>
              C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86
            </Text>
            <Text style={s.programIdNetwork}>Solana Mainnet</Text>
          </View>
        </View>

        <Divider />

        {/* ── Community ── */}
        <View onLayout={(e) => { sectionRefs.current['community'] = e.nativeEvent.layout.y; }}>
          <H2>Join the Revolution</H2>
          <P>
            The world is full of brilliant ideas waiting to be discovered — and brilliant people waiting to discover them. PNL connects the two. Whether you're a dreamer, an early supporter, or a critic — <B>this is where you belong.</B>
          </P>

          {/* Why PNL */}
          <View style={s.whyGrid}>
            <View style={s.whyCard}>
              <Text style={[s.whyValue, { color: '#3b82f6' }]}>Needed</Text>
              <Text style={s.whyDesc}>Ideas die for lack of access</Text>
            </View>
            <View style={s.whyCard}>
              <Text style={[s.whyValue, { color: '#22c55e' }]}>Aligned</Text>
              <Text style={s.whyDesc}>Everyone wins when quality rises</Text>
            </View>
            <View style={s.whyCard}>
              <Text style={[s.whyValue, { color: '#a855f7' }]}>Proven</Text>
              <Text style={s.whyDesc}>Battle-tested AMM + prediction markets</Text>
            </View>
            <View style={s.whyCard}>
              <Text style={[s.whyValue, { color: '#eab308' }]}>Global</Text>
              <Text style={s.whyDesc}>The next unicorn could be anywhere</Text>
            </View>
          </View>

          {/* Mission */}
          <View style={s.missionBoxFinal}>
            <Text style={s.missionFinalTitle}>Fueling the world's brilliant ideas.</Text>
            <Text style={s.missionFinalSub}>From anywhere, for everyone. Yours could be next.</Text>
          </View>

          {/* Connect */}
          <H3>Connect With Us</H3>
          <PressableScale
            onPress={() => Linking.openURL('https://x.com/pnldotmarket')}
            style={s.socialRow}
          >
            <View style={[s.socialIcon, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
              <Text style={{ color: '#60a5fa', fontSize: 16, fontWeight: '700' }}>𝕏</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.socialTitle}>X (Twitter)</Text>
              <Text style={s.socialHandle}>@pnldotmarket</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </PressableScale>

          <PressableScale
            onPress={() => Linking.openURL('https://discord.gg/38pkg4vm')}
            style={s.socialRow}
          >
            <View style={[s.socialIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
              <Ionicons name="logo-discord" size={18} color="#818cf8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.socialTitle}>Discord</Text>
              <Text style={s.socialHandle}>Join the community</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </PressableScale>
        </View>

        {/* ── Footer ── */}
        <Divider />
        <View style={s.footer}>
          <Text style={s.footerQuote}>
            "Let the market decide. Launch with confidence. Build with accountability."
          </Text>
          <Text style={s.footerTeam}>— PNL Team</Text>
          <Text style={s.footerCopy}>© 2025 PNL (Prediction & Launch Platform). All rights reserved.</Text>
          <Text style={s.footerDisclaimer}>
            This whitepaper is for informational purposes only and does not constitute financial, investment, or legal advice. Token launches involve substantial risk.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.title, color: colors.textPrimary },
  // TOC
  tocOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
    backgroundColor: 'rgba(10, 14, 26, 0.95)', paddingHorizontal: spacing.lg,
  },
  tocTitle: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.lg },
  tocItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tocNum: { ...typography.bodyBold, color: colors.primary, width: 28 },
  tocText: { ...typography.body, color: colors.textPrimary },
  // Content
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  // Title
  titleBlock: { alignItems: 'center', marginBottom: spacing.md },
  mainTitle: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  tagline: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, maxWidth: 300 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  meta: { ...typography.micro, color: colors.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },
  // Mission
  missionBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.08)', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.3)', padding: spacing.md,
    alignItems: 'center', marginTop: spacing.md,
  },
  missionText: { ...typography.body, color: colors.textPrimary, fontWeight: '600', textAlign: 'center', fontStyle: 'italic' },
  missionSub: { ...typography.caption, color: '#eab308', marginTop: 4 },
  // Typography
  h2: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  h3: { fontSize: 17, fontWeight: '700', color: colors.primary, marginTop: spacing.md, marginBottom: spacing.xs },
  p: { ...typography.body, color: colors.textSecondary, lineHeight: 24, marginBottom: spacing.sm },
  bold: { fontWeight: '700', color: colors.textPrimary },
  bulletRow: { flexDirection: 'row', paddingLeft: spacing.sm, marginBottom: 6 },
  bulletDot: { color: colors.primary, fontSize: 16, lineHeight: 22, marginRight: spacing.sm },
  bulletText: { ...typography.body, color: colors.textSecondary, flex: 1, lineHeight: 22 },
  codeBlock: {
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginVertical: spacing.sm,
  },
  codeText: { fontFamily: 'Menlo', fontSize: 11, color: colors.textSecondary, lineHeight: 17 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  highlightBox: {
    backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: borderRadius.md,
    borderLeftWidth: 3, borderLeftColor: colors.primary, padding: spacing.md, marginVertical: spacing.sm,
  },
  centeredCaption: { ...typography.caption, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic', marginVertical: spacing.sm },
  // Color cards
  colorCard: {
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.md,
    borderWidth: 1, padding: spacing.md, marginVertical: spacing.xs,
  },
  colorCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  colorCardSubtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  cardBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  // Steps
  stepsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  stepCard: {
    width: '47%' as any, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.md,
    borderWidth: 1, padding: spacing.sm + 4, alignItems: 'center',
  },
  stepBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stepBadgeText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  stepTitle: { fontWeight: '700', fontSize: 15, marginBottom: 2 },
  stepDesc: { ...typography.micro, color: colors.textMuted, textAlign: 'center' },
  stepDetail: { ...typography.micro, fontWeight: '600', marginTop: 4 },
  // Outcomes
  outcomesRow: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.sm },
  outcomeCard: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.md,
    borderWidth: 1, padding: spacing.sm, alignItems: 'center',
  },
  outcomeTitle: { fontWeight: '700', fontSize: 13, marginBottom: 2 },
  outcomeDesc: { ...typography.micro, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },
  // Stats
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  statCard: {
    flex: 1, backgroundColor: colors.glass, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.md, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { ...typography.micro, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  // Comparison
  comparisonRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  comparisonCard: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.md,
    borderWidth: 1, padding: spacing.sm,
  },
  comparisonTitle: { fontWeight: '700', fontSize: 13, marginBottom: spacing.xs },
  comparisonResult: { ...typography.micro, fontWeight: '700', marginTop: spacing.xs },
  // Fee grid
  feeGrid: {
    backgroundColor: colors.glass, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden', marginVertical: spacing.sm,
  },
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  feeValue: { fontSize: 18, fontWeight: '800' },
  feeLabel: { ...typography.micro, color: colors.textMuted },
  feeNote: { ...typography.micro, color: colors.textMuted },
  // Tech grid
  techGrid: {
    backgroundColor: colors.glass, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden', marginVertical: spacing.sm,
  },
  techRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  techLabel: { fontWeight: '700', fontSize: 13 },
  techValue: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', flex: 1, marginLeft: spacing.sm },
  // Security
  securityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  securityCard: {
    width: '47%' as any, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', padding: spacing.sm,
  },
  securityTitle: { ...typography.caption, color: colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  securityDesc: { ...typography.micro, color: colors.textMuted, lineHeight: 16 },
  // Program ID
  programId: {
    backgroundColor: colors.glass, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.md,
  },
  programIdLabel: { ...typography.micro, color: colors.textMuted, marginBottom: 4 },
  programIdValue: { fontFamily: 'Menlo', fontSize: 11, color: colors.primary, textAlign: 'center' },
  programIdNetwork: { ...typography.micro, color: colors.textMuted, marginTop: 4 },
  // Feature grid
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  featureChip: {
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    alignItems: 'center', minWidth: 100,
  },
  featureChipText: { fontWeight: '700', fontSize: 13 },
  featureChipDesc: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
  // Why grid
  whyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  whyCard: {
    width: '47%' as any, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.sm,
  },
  whyValue: { fontWeight: '800', fontSize: 16, marginBottom: 2 },
  whyDesc: { ...typography.micro, color: colors.textMuted },
  // Mission final
  missionBoxFinal: {
    backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: borderRadius.md,
    borderWidth: 2, borderColor: 'rgba(99,102,241,0.3)', padding: spacing.lg,
    alignItems: 'center', marginVertical: spacing.md,
  },
  missionFinalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  missionFinalSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  // Social
  socialRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm,
  },
  socialIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  socialTitle: { ...typography.bodyBold, color: colors.textPrimary },
  socialHandle: { ...typography.micro, color: colors.textMuted },
  // Footer
  footer: { alignItems: 'center', paddingVertical: spacing.lg },
  footerQuote: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', maxWidth: 300 },
  footerTeam: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.xs },
  footerCopy: { ...typography.micro, color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' },
  footerDisclaimer: { ...typography.micro, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, maxWidth: 300, lineHeight: 16 },
});
