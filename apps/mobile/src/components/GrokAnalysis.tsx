/**
 * GrokAnalysis — AI-powered market analysis (ported from web GrokRoast.tsx)
 * Shows initial roast + resolution analysis powered by xAI Grok
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiUrl } from '@pnl/shared/utils';
import { colors, spacing, borderRadius, typography } from '../theme';
import { GlassCard } from './GlassCard';

// ── Types ──────────────────────────────────────────────────────────────────

interface GrokAnalysisData {
  type: 'initial_roast' | 'resolution_analysis';
  content: string;
  generatedAt: string;
  model: string;
  votingData?: {
    totalYesVotes: number;
    totalNoVotes: number;
    yesPercentage: number;
    totalParticipants: number;
    outcome: string;
  };
}

interface GrokAnalysisProps {
  marketId: string;
  resolution?: string;
  votingData?: {
    totalYesVotes: number;
    totalNoVotes: number;
    yesPercentage: number;
    totalParticipants: number;
  };
}

// ── Markdown stripping ─────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  let result = text;
  for (let i = 0; i < 5; i++) {
    result = result
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_\s][^_]*)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
  }
  return result
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(\w)/g, '$1')
    .replace(/(\w)\*\*/g, '$1')
    .replace(/([^*])\*(\w)/g, '$1$2')
    .replace(/(\w)\*([^*])/g, '$1$2')
    .replace(/\s\*\s/g, ' ')
    .replace(/^\*\s/gm, '')
    .replace(/\*+/g, '')
    .replace(/  +/g, ' ')
    .trim();
}

// ── Parsing helpers ────────────────────────────────────────────────────────

function parseInitialRoast(content: string) {
  const result = { roast: '', redFlags: [] as string[], positives: [] as string[], legitScore: '', explanation: '' };

  const roastMatch = content.match(/\*{0,2}[🔥]?\s*THE ROAST:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*RED FLAGS|$)/i);
  if (roastMatch) result.roast = stripMarkdown(roastMatch[1]);

  const redFlagsMatch = content.match(/\*{0,2}[🚩]?\s*RED FLAGS:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*POTENTIAL UPSIDE|$)/i);
  if (redFlagsMatch) {
    result.redFlags = redFlagsMatch[1]
      .split('\n')
      .map(line => stripMarkdown(line.replace(/^[-•*\d.)\]]+\s*/, '')))
      .filter(line => line.length > 0);
  }

  const positivesMatch = content.match(/\*{0,2}[✨🚀]?\s*POTENTIAL UPSIDE:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*LEGIT SCORE|$)/i);
  if (positivesMatch) {
    result.positives = positivesMatch[1]
      .split('\n')
      .map(line => stripMarkdown(line.replace(/^[-•*\d.)\]]+\s*/, '')))
      .filter(line => line.length > 0);
  }

  const scoreMatch = content.match(/LEGIT SCORE:?\s*(\d+)\s*[\/\\]\s*10/i);
  if (scoreMatch) result.legitScore = scoreMatch[1];

  const explanationMatch = content.match(/LEGIT SCORE:?\s*\d+\s*[\/\\]\s*10\s*\*{0,2}\s*([\s\S]*?)$/i);
  if (explanationMatch) result.explanation = stripMarkdown(explanationMatch[1]);

  return result;
}

function parseResolutionAnalysis(content: string) {
  const result = { verdict: '', crowdAnalysis: '', crowdWisdomRating: '', whatsNext: [] as string[] };

  const verdictMatch = content.match(/\*{0,2}[🚀💀💸⚡]?\s*FINAL VERDICT:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*CROWD ANALYSIS|$)/i);
  if (verdictMatch) result.verdict = stripMarkdown(verdictMatch[1]);

  const crowdMatch = content.match(/\*{0,2}[👥]?\s*CROWD ANALYSIS:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*CROWD WISDOM RATING|$)/i);
  if (crowdMatch) result.crowdAnalysis = stripMarkdown(crowdMatch[1]);

  const ratingMatch = content.match(/CROWD WISDOM RATING:?\s*(\d+)\s*[\/\\]\s*10/i);
  if (ratingMatch) result.crowdWisdomRating = ratingMatch[1];

  const nextMatch = content.match(/\*{0,2}[🔮]?\s*WHAT'?S NEXT:?\s*\*{0,2}:?\s*([\s\S]*?)$/i);
  if (nextMatch) {
    result.whatsNext = nextMatch[1]
      .split('\n')
      .map(line => stripMarkdown(line.replace(/^[-•*\d.)\]]+\s*/, '')))
      .filter(line => line.length > 0);
  }

  return result;
}

function getScoreColors(score: string): { text: string; bg: string; border: string } {
  const n = parseInt(score, 10);
  if (n >= 7) return { text: colors.success, bg: colors.successLight, border: 'rgba(16, 185, 129, 0.3)' };
  if (n >= 4) return { text: colors.warning, bg: colors.warningLight, border: 'rgba(245, 158, 11, 0.3)' };
  return { text: colors.danger, bg: colors.dangerLight, border: 'rgba(239, 68, 68, 0.3)' };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ScoreBadge({ score, label }: { score: string; label: string }) {
  const c = getScoreColors(score);
  return (
    <View style={[styles.scoreBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreNumber, { color: c.text }]}>{score}</Text>
        <Text style={styles.scoreSlash}>/10</Text>
      </View>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

function ListSection({
  title,
  icon,
  iconColor,
  bgColor,
  borderColor,
  items,
  marker,
  markerColor,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  items: string[];
  marker: string;
  markerColor: string;
}) {
  if (items.length === 0) return null;
  return (
    <View style={[styles.listSection, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.listHeader}>
        <View style={[styles.listIconWrap, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={14} color={iconColor} />
        </View>
        <Text style={[styles.listTitle, { color: iconColor }]}>{title}</Text>
        <View style={[styles.countBadge, { backgroundColor: bgColor }]}>
          <Text style={[styles.countText, { color: iconColor }]}>{items.length}</Text>
        </View>
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <View style={[styles.markerCircle, { backgroundColor: bgColor }]}>
            <Text style={[styles.markerText, { color: markerColor }]}>{marker}</Text>
          </View>
          <Text style={styles.listItemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function InitialRoastCard({ analysis }: { analysis: GrokAnalysisData }) {
  const parsed = parseInitialRoast(analysis.content);

  return (
    <View style={styles.cardInner}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.sparkleIcon}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.cardTitle}>AI Analysis</Text>
            <Text style={styles.cardDate}>
              {new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </View>
        {parsed.legitScore ? <ScoreBadge score={parsed.legitScore} label="Legit Score" /> : null}
      </View>

      {/* Roast quote */}
      {parsed.roast ? (
        <View style={styles.roastQuote}>
          <View style={styles.roastBar} />
          <Text style={styles.roastText}>&ldquo;{parsed.roast}&rdquo;</Text>
        </View>
      ) : null}

      {/* Red Flags */}
      <ListSection
        title="Red Flags"
        icon="warning-outline"
        iconColor={colors.danger}
        bgColor={colors.dangerLight}
        borderColor="rgba(239, 68, 68, 0.2)"
        items={parsed.redFlags}
        marker="✕"
        markerColor={colors.danger}
      />

      {/* Potential Upside */}
      <ListSection
        title="Potential Upside"
        icon="trending-up"
        iconColor={colors.success}
        bgColor={colors.successLight}
        borderColor="rgba(16, 185, 129, 0.2)"
        items={parsed.positives}
        marker="✓"
        markerColor={colors.success}
      />

      {/* Verdict */}
      {parsed.explanation ? (
        <GlassCard style={styles.verdictCard}>
          <View style={styles.verdictInner}>
            <View style={[styles.verdictIcon, { backgroundColor: parsed.legitScore ? getScoreColors(parsed.legitScore).bg : colors.glass }]}>
              <Ionicons name="locate-outline" size={16} color={parsed.legitScore ? getScoreColors(parsed.legitScore).text : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verdictLabel}>Verdict</Text>
              <Text style={styles.verdictText}>{parsed.explanation}</Text>
            </View>
          </View>
        </GlassCard>
      ) : null}
    </View>
  );
}

function ResolutionAnalysisCard({ analysis }: { analysis: GrokAnalysisData }) {
  const parsed = parseResolutionAnalysis(analysis.content);
  const outcome = analysis.votingData?.outcome;

  const outcomeConfig = outcome === 'YesWins'
    ? { icon: 'rocket-outline' as const, label: 'YES Wins', color: colors.success, bg: colors.successLight }
    : outcome === 'NoWins'
      ? { icon: 'close-circle-outline' as const, label: 'NO Wins', color: colors.danger, bg: colors.dangerLight }
      : { icon: 'cash-outline' as const, label: 'Refund', color: colors.warning, bg: colors.warningLight };

  return (
    <View style={styles.cardInner}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.sparkleIcon, { backgroundColor: outcomeConfig.color }]}>
            <Ionicons name="trophy-outline" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.cardTitle}>Resolution</Text>
            <View style={styles.outcomeBadgeRow}>
              <View style={[styles.outcomeBadge, { backgroundColor: outcomeConfig.bg }]}>
                <Ionicons name={outcomeConfig.icon} size={12} color={outcomeConfig.color} />
                <Text style={[styles.outcomeBadgeText, { color: outcomeConfig.color }]}>{outcomeConfig.label}</Text>
              </View>
              <Text style={styles.cardDate}>
                {new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>
        {parsed.crowdWisdomRating ? <ScoreBadge score={parsed.crowdWisdomRating} label="Crowd Wisdom" /> : null}
      </View>

      {/* Voting stats grid */}
      {analysis.votingData ? (
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.successLight, borderColor: 'rgba(16,185,129,0.3)' }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{analysis.votingData.totalYesVotes}</Text>
            <Text style={styles.statLabel}>YES Votes</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.dangerLight, borderColor: 'rgba(239,68,68,0.3)' }]}>
            <Text style={[styles.statValue, { color: colors.danger }]}>{analysis.votingData.totalNoVotes}</Text>
            <Text style={styles.statLabel}>NO Votes</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(34,211,238,0.15)', borderColor: 'rgba(34,211,238,0.3)' }]}>
            <Text style={[styles.statValue, { color: '#22d3ee' }]}>{analysis.votingData.totalParticipants}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      ) : null}

      {/* Final verdict */}
      {parsed.verdict ? (
        <View style={[styles.roastQuote, { backgroundColor: outcomeConfig.bg }]}>
          <View style={[styles.roastBar, { backgroundColor: outcomeConfig.color }]} />
          <Text style={styles.verdictQuoteText}>{parsed.verdict}</Text>
        </View>
      ) : null}

      {/* Crowd Analysis */}
      {parsed.crowdAnalysis ? (
        <View style={[styles.listSection, { backgroundColor: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.2)' }]}>
          <View style={styles.listHeader}>
            <View style={[styles.listIconWrap, { backgroundColor: 'rgba(34,211,238,0.2)' }]}>
              <Ionicons name="people-outline" size={14} color="#22d3ee" />
            </View>
            <Text style={[styles.listTitle, { color: '#22d3ee' }]}>Crowd Analysis</Text>
          </View>
          <Text style={styles.crowdAnalysisText}>{parsed.crowdAnalysis}</Text>
        </View>
      ) : null}

      {/* What's Next */}
      {parsed.whatsNext.length > 0 ? (
        <View style={[styles.listSection, { backgroundColor: 'rgba(129,140,248,0.1)', borderColor: 'rgba(129,140,248,0.2)' }]}>
          <View style={styles.listHeader}>
            <View style={[styles.listIconWrap, { backgroundColor: 'rgba(129,140,248,0.2)' }]}>
              <Ionicons name="trending-up" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.listTitle, { color: colors.primary }]}>What&apos;s Next</Text>
            <View style={[styles.countBadge, { backgroundColor: 'rgba(129,140,248,0.1)' }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>{parsed.whatsNext.length}</Text>
            </View>
          </View>
          {parsed.whatsNext.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <View style={[styles.markerCircle, { backgroundColor: 'rgba(129,140,248,0.2)' }]}>
                <Text style={[styles.markerText, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <Text style={styles.listItemText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function GrokAnalysis({ marketId, resolution, votingData }: GrokAnalysisProps) {
  const [analyses, setAnalyses] = useState<GrokAnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingResolution, setGeneratingResolution] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTriggeredResolution, setHasTriggeredResolution] = useState(false);
  const [hasTriggeredInitial, setHasTriggeredInitial] = useState(false);
  const [showInitialReview, setShowInitialReview] = useState(false);

  // Fetch existing analyses (and auto-generate initial roast if missing)
  useEffect(() => {
    let mounted = true;

    const fetchAnalyses = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(apiUrl(`/api/grok/roast?marketId=${marketId}`));
        const data = await response.json();
        if (!mounted) return;

        if (data.success && data.data.analyses) {
          setAnalyses(data.data.analyses);

          // Auto-generate initial roast if none exists
          if (!data.data.hasInitialRoast && !hasTriggeredInitial) {
            setHasTriggeredInitial(true);
            try {
              const postRes = await fetch(apiUrl('/api/grok/roast'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketId, type: 'initial_roast' }),
              });
              const postData = await postRes.json();
              if (mounted && postData.success) {
                setAnalyses(postData.data.allAnalyses);
              }
            } catch {
              // Silently fail — initial roast is non-critical
            }
          }
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to fetch analyses');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAnalyses();
    return () => { mounted = false; };
  }, [marketId, hasTriggeredInitial]);

  // Generate resolution analysis when market resolves
  useEffect(() => {
    if (!resolution || resolution === 'Unresolved') return;
    if (!votingData || loading || hasTriggeredResolution) return;
    if (analyses.some(a => a.type === 'resolution_analysis')) return;

    setHasTriggeredResolution(true);

    const generate = async () => {
      try {
        setGeneratingResolution(true);
        const response = await fetch(apiUrl('/api/grok/roast'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId,
            type: 'resolution_analysis',
            votingData: { ...votingData, outcome: resolution },
          }),
        });
        const data = await response.json();
        if (data.success) setAnalyses(data.data.allAnalyses);
      } catch {
        setHasTriggeredResolution(false); // Allow retry
      } finally {
        setGeneratingResolution(false);
      }
    };

    if (analyses.length > 0) generate();
  }, [marketId, resolution, votingData, analyses, loading, hasTriggeredResolution]);

  // ── Loading state ──
  if (loading) {
    return (
      <View style={styles.centered}>
        <View style={styles.sparkleIcon}>
          <Ionicons name="sparkles" size={18} color="#fff" />
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.loadingText}>Loading analysis...</Text>
        </View>
      </View>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="warning-outline" size={24} color={colors.danger} />
        <Text style={[styles.loadingText, { color: colors.danger }]}>{error}</Text>
      </View>
    );
  }

  // ── Empty state ──
  if (analyses.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={[styles.sparkleIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name="sparkles" size={18} color={colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>AI analysis will appear here</Text>
        <Text style={styles.emptySubtitle}>Generating automatically...</Text>
      </View>
    );
  }

  // ── Deduplicate & sort ──
  const deduped = analyses.reduce((acc, a) => {
    const existing = acc.find(x => x.type === a.type);
    if (!existing) { acc.push(a); }
    else if (new Date(a.generatedAt).getTime() > new Date(existing.generatedAt).getTime()) {
      acc[acc.indexOf(existing)] = a;
    }
    return acc;
  }, [] as GrokAnalysisData[]);

  const sorted = deduped.sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime());
  const initialRoast = sorted.find(a => a.type === 'initial_roast');
  const resolutionAnalysis = sorted.find(a => a.type === 'resolution_analysis');
  const hasResolution = !!resolutionAnalysis;

  return (
    <View style={styles.wrapper}>
      {hasResolution && resolutionAnalysis ? (
        <>
          <ResolutionAnalysisCard analysis={resolutionAnalysis} />

          {/* Collapsible initial review */}
          {initialRoast ? (
            <View style={styles.collapseWrap}>
              <Pressable
                onPress={() => setShowInitialReview(!showInitialReview)}
                style={styles.collapseButton}
              >
                <View style={styles.collapseLeft}>
                  <View style={[styles.smallSparkle, { backgroundColor: 'rgba(129,140,248,0.2)' }]}>
                    <Ionicons name="sparkles" size={14} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.collapseTitle}>Initial AI Analysis</Text>
                    <Text style={styles.collapseDate}>
                      {new Date(initialRoast.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
                <View style={styles.collapseRight}>
                  <Text style={styles.collapseToggle}>{showInitialReview ? 'Hide' : 'View'}</Text>
                  <Ionicons
                    name={showInitialReview ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </Pressable>
              {showInitialReview ? (
                <GlassCard style={styles.collapseContent}>
                  <InitialRoastCard analysis={initialRoast} />
                </GlassCard>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        sorted.map((a, i) => (
          <View key={i}>
            {a.type === 'initial_roast' ? <InitialRoastCard analysis={a} /> : <ResolutionAnalysisCard analysis={a} />}
          </View>
        ))
      )}

      {generatingResolution ? (
        <View style={styles.generatingRow}>
          <ActivityIndicator size="small" color={colors.warning} />
          <Text style={[styles.loadingText, { color: colors.warning }]}>Analyzing resolution...</Text>
        </View>
      ) : null}

      {/* Powered by footer */}
      <View style={styles.footer}>
        <Ionicons name="cube-outline" size={12} color={colors.textMuted} />
        <Text style={styles.footerText}>Powered by xAI Grok</Text>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  centered: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  loadingText: { ...typography.caption, color: colors.textMuted },
  emptyTitle: { ...typography.caption, color: colors.textSecondary },
  emptySubtitle: { ...typography.micro, color: colors.textMuted },
  generatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },

  // Card inner
  cardInner: { gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  sparkleIcon: {
    width: 36, height: 36, borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary },
  cardDate: { ...typography.micro, color: colors.textMuted },

  // Score badge
  scoreBadge: {
    alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, borderWidth: 1,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  scoreNumber: { fontSize: 22, fontWeight: '900' },
  scoreSlash: { ...typography.caption, color: colors.textMuted, marginLeft: 2 },
  scoreLabel: { ...typography.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Roast quote
  roastQuote: {
    flexDirection: 'row', borderRadius: borderRadius.md,
    backgroundColor: 'rgba(129,140,248,0.08)', padding: spacing.md,
  },
  roastBar: {
    width: 3, borderRadius: 2, marginRight: spacing.sm,
    backgroundColor: colors.accent,
  },
  roastText: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', flex: 1, lineHeight: 22 },
  verdictQuoteText: { ...typography.caption, color: colors.textSecondary, fontWeight: '500', flex: 1, lineHeight: 22 },

  // List section
  listSection: { borderRadius: borderRadius.md, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  listIconWrap: { width: 24, height: 24, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  listTitle: { ...typography.captionBold },
  countBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  countText: { ...typography.micro },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: borderRadius.sm, padding: spacing.sm },
  markerCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  markerText: { fontSize: 11, fontWeight: '600' },
  listItemText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 22 },

  // Verdict card
  verdictCard: { padding: spacing.md },
  verdictInner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  verdictIcon: { width: 32, height: 32, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  verdictLabel: { ...typography.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  verdictText: { ...typography.caption, color: colors.textSecondary, lineHeight: 22 },

  // Resolution stats
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, borderRadius: borderRadius.md, borderWidth: 1,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { ...typography.micro, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Outcome badge
  outcomeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  outcomeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full,
  },
  outcomeBadgeText: { ...typography.micro, fontWeight: '500' },

  // Crowd analysis text
  crowdAnalysisText: { ...typography.caption, color: colors.textSecondary, lineHeight: 22 },

  // Collapse
  collapseWrap: { marginTop: spacing.md },
  collapseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  collapseLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallSparkle: { width: 28, height: 28, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  collapseTitle: { ...typography.captionBold, color: colors.textSecondary },
  collapseDate: { ...typography.micro, color: colors.textMuted },
  collapseRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  collapseToggle: { ...typography.micro, color: colors.textMuted },
  collapseContent: { marginTop: spacing.sm, padding: spacing.md },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: { fontSize: 10, color: colors.textMuted },
});
