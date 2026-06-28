'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertTriangle, TrendingUp, Target, Trophy, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { CREAM, CREAM_DIM, CREAM_FAINT, HAIR_STRONG, AMBER, FOREST, EARTH, SIGNAL_GREEN } from '@/lib/palette';

// Shared card surface — the brand's "hairline + faint wash, no nested gradient
// boxes" treatment, matching the rest of the cosmic cream/amber pages.
const CARD: React.CSSProperties = {
  background: 'rgba(244,238,228,0.025)',
  border: `1px solid ${HAIR_STRONG}`,
  borderRadius: 12,
};

/**
 * Strip markdown formatting from text - super aggressive version
 */
function stripMarkdown(text: string): string {
  let result = text;

  // Multiple passes to handle nested formatting
  for (let i = 0; i < 5; i++) {
    result = result
      // Remove ***bold italic*** (triple asterisks)
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      // Remove **bold** (double asterisks)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // Remove *text* (single asterisks) - but be careful with bullet points
      .replace(/\*([^*\n]+)\*/g, '$1')
      // Remove __bold__ (double underscores)
      .replace(/__([^_]+)__/g, '$1')
      // Remove _italic_ (single underscores)
      .replace(/_([^_\s][^_]*)_/g, '$1')
      // Remove `code` (backticks)
      .replace(/`([^`]+)`/g, '$1');
  }

  return result
    // Remove ## headers
    .replace(/^#{1,6}\s*/gm, '')
    // Remove any remaining ** at word boundaries
    .replace(/\*\*(\w)/g, '$1')
    .replace(/(\w)\*\*/g, '$1')
    // Remove remaining single * at word boundaries (but not **)
    .replace(/([^*])\*(\w)/g, '$1$2')
    .replace(/(\w)\*([^*])/g, '$1$2')
    // Remove standalone asterisks
    .replace(/\s\*\s/g, ' ')
    .replace(/^\*\s/gm, '')
    // Final cleanup - remove any stray asterisks
    .replace(/\*+/g, '')
    // Clean up any double spaces
    .replace(/  +/g, ' ')
    .trim();
}

interface GrokAnalysis {
  type: 'initial_roast' | 'resolution_analysis';
  content: string;
  // 'json' = content is a JSON string matching the structured schema;
  // 'markdown' / undefined = legacy prose parsed by regex below.
  format?: 'markdown' | 'json';
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

interface GrokRoastProps {
  marketId: string;
  resolution?: string;
  // Voting data for triggering resolution analysis
  votingData?: {
    totalYesVotes: number;
    totalNoVotes: number;
    yesPercentage: number;
    totalParticipants: number;
  };
}

/**
 * Whether an analysis should be read as structured JSON rather than legacy prose.
 * Trusts the explicit format flag, but also sniffs a leading `{` so a JSON roast
 * still renders even if the flag is missing.
 */
function isJsonFormat(content: string, format?: string): boolean {
  return format === 'json' || content.trimStart().startsWith('{');
}

/**
 * Parse initial roast content into sections.
 * Structured (JSON) roasts are read directly; legacy markdown falls back to regex.
 */
function parseInitialRoast(content: string, format?: string): {
  roast: string;
  redFlags: string[];
  positives: string[];
  legitScore: string;
  explanation: string;
  verifiedFacts: string[];
} {
  const result = {
    roast: '',
    redFlags: [] as string[],
    positives: [] as string[],
    legitScore: '',
    explanation: '',
    verifiedFacts: [] as string[],
  };

  if (isJsonFormat(content, format)) {
    try {
      const j = JSON.parse(content);
      return {
        roast: typeof j.roast === 'string' ? j.roast : '',
        redFlags: Array.isArray(j.redFlags) ? j.redFlags.map(String) : [],
        positives: Array.isArray(j.positives) ? j.positives.map(String) : [],
        legitScore: j.legitScore != null ? String(j.legitScore) : '',
        explanation: typeof j.explanation === 'string' ? j.explanation : '',
        // Deterministic ground-truth facts (newer reviews only; absent on legacy).
        verifiedFacts: Array.isArray(j.verifiedFacts) ? j.verifiedFacts.map(String) : [],
      };
    } catch {
      // Malformed JSON — fall through to the regex parser below.
    }
  }

  // Extract THE ROAST section - flexible pattern
  const roastMatch = content.match(/\*{0,2}[🔥]?\s*THE ROAST:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*RED FLAGS|$)/i);
  if (roastMatch) {
    result.roast = stripMarkdown(roastMatch[1]);
  }

  // Extract RED FLAGS section - flexible pattern
  const redFlagsMatch = content.match(/\*{0,2}[🚩]?\s*RED FLAGS:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*POTENTIAL UPSIDE|$)/i);
  if (redFlagsMatch) {
    result.redFlags = redFlagsMatch[1]
      .split('\n')
      .map(line => stripMarkdown(line.replace(/^[-•*\d.)\]]+\s*/, '')))
      .filter(line => line.length > 0);
  }

  // Extract POTENTIAL UPSIDE section - flexible pattern
  const positivesMatch = content.match(/\*{0,2}[✨🚀]?\s*POTENTIAL UPSIDE:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*LEGIT SCORE|$)/i);
  if (positivesMatch) {
    result.positives = positivesMatch[1]
      .split('\n')
      .map(line => stripMarkdown(line.replace(/^[-•*\d.)\]]+\s*/, '')))
      .filter(line => line.length > 0);
  }

  // Extract LEGIT SCORE - flexible pattern
  const scoreMatch = content.match(/LEGIT SCORE:?\s*(\d+)\s*[\/\\]\s*10/i);
  if (scoreMatch) {
    result.legitScore = scoreMatch[1];
  }

  // Extract explanation after score
  const explanationMatch = content.match(/LEGIT SCORE:?\s*\d+\s*[\/\\]\s*10\s*\*{0,2}\s*([\s\S]*?)$/i);
  if (explanationMatch) {
    result.explanation = stripMarkdown(explanationMatch[1]);
  }

  return result;
}

/**
 * Parse resolution analysis content into sections.
 * Structured (JSON) analyses are read directly; legacy markdown falls back to regex.
 */
function parseResolutionAnalysis(content: string, format?: string): {
  verdict: string;
  crowdAnalysis: string;
  crowdWisdomRating: string;
  whatsNext: string[];
} {
  const result = {
    verdict: '',
    crowdAnalysis: '',
    crowdWisdomRating: '',
    whatsNext: [] as string[],
  };

  if (isJsonFormat(content, format)) {
    try {
      const j = JSON.parse(content);
      return {
        verdict: typeof j.verdict === 'string' ? j.verdict : '',
        crowdAnalysis: typeof j.crowdAnalysis === 'string' ? j.crowdAnalysis : '',
        crowdWisdomRating: j.crowdWisdomRating != null ? String(j.crowdWisdomRating) : '',
        whatsNext: Array.isArray(j.whatsNext) ? j.whatsNext.map(String) : [],
      };
    } catch {
      // Malformed JSON — fall through to the regex parser below.
    }
  }

  // Extract FINAL VERDICT - flexible pattern
  const verdictMatch = content.match(/\*{0,2}[🚀💀💸⚡]?\s*FINAL VERDICT:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*CROWD ANALYSIS|$)/i);
  if (verdictMatch) {
    result.verdict = stripMarkdown(verdictMatch[1]);
  }

  // Extract CROWD ANALYSIS - flexible pattern
  const crowdMatch = content.match(/\*{0,2}[👥]?\s*CROWD ANALYSIS:?\s*\*{0,2}:?\s*([\s\S]*?)(?=\*{0,2}\s*CROWD WISDOM RATING|$)/i);
  if (crowdMatch) {
    result.crowdAnalysis = stripMarkdown(crowdMatch[1]);
  }

  // Extract CROWD WISDOM RATING - flexible pattern
  const ratingMatch = content.match(/CROWD WISDOM RATING:?\s*(\d+)\s*[\/\\]\s*10/i);
  if (ratingMatch) {
    result.crowdWisdomRating = ratingMatch[1];
  }

  // Extract WHAT'S NEXT - flexible pattern
  const nextMatch = content.match(/\*{0,2}[🔮]?\s*WHAT'?S NEXT:?\s*\*{0,2}:?\s*([\s\S]*?)$/i);
  if (nextMatch) {
    result.whatsNext = nextMatch[1]
      .split('\n')
      .map(line => stripMarkdown(line.replace(/^[-•*\d.)\]]+\s*/, '')))
      .filter(line => line.length > 0);
  }

  return result;
}

/**
 * Score → brand colour (hex, for inline styles). High = forest green,
 * mid = amber, low = earth — the cosmic palette, not generic green/yellow/red.
 */
function getScoreColor(score: string): { text: string } {
  const n = parseInt(score, 10);
  if (n >= 7) return { text: SIGNAL_GREEN };
  if (n >= 4) return { text: AMBER };
  return { text: EARTH };
}

/**
 * Initial Roast Card Component
 */
function InitialRoastCard({ analysis }: { analysis: GrokAnalysis }) {
  const parsed = parseInitialRoast(analysis.content, analysis.format);
  const scoreColors = parsed.legitScore ? getScoreColor(parsed.legitScore) : null;

  return (
    <div className="space-y-4" style={{ color: CREAM }}>
      {/* Header with Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(232,150,96,0.14)' }}>
            <Sparkles className="w-4 h-4" style={{ color: AMBER }} />
          </div>
          <div>
            <h4 className="font-semibold text-sm" style={{ color: CREAM }}>AI analysis</h4>
            <p className="mono text-[0.6rem]" style={{ color: CREAM_FAINT }}>
              {new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        {parsed.legitScore && scoreColors && (
          <div className="flex flex-col items-center px-3.5 py-1.5 rounded-lg" style={{ border: `1px solid ${scoreColors.text}55`, background: `${scoreColors.text}14` }}>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold" style={{ color: scoreColors.text }}>{parsed.legitScore}</span>
              <span className="text-sm ml-0.5" style={{ color: CREAM_FAINT }}>/10</span>
            </div>
            <span className="mono uppercase tracking-[0.2em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>legit score</span>
          </div>
        )}
      </div>

      {/* The take */}
      {parsed.roast && (
        <div className="pl-3" style={{ borderLeft: `2px solid ${AMBER}` }}>
          <p className="italic text-sm leading-relaxed" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}>
            &ldquo;{parsed.roast}&rdquo;
          </p>
        </div>
      )}

      <div className="space-y-3">
        {/* Verified — deterministic ground truth, leads the section. */}
        {parsed.verifiedFacts.length > 0 && (
          <div className="p-4" style={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs" style={{ color: SIGNAL_GREEN }}>✓</span>
              <span className="mono uppercase tracking-[0.18em] text-[0.6rem] font-semibold" style={{ color: SIGNAL_GREEN }}>Verified</span>
              <span className="mono uppercase tracking-[0.15em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>automated checks</span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {parsed.verifiedFacts.map((fact, i) => (
                <li key={i} className="text-xs rounded-full px-3 py-1" style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}>
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags */}
        {parsed.redFlags.length > 0 && (
          <div className="p-4" style={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: EARTH }} />
              <span className="mono uppercase tracking-[0.18em] text-[0.6rem] font-semibold" style={{ color: EARTH }}>Red flags</span>
              <span className="mono text-[0.55rem] rounded-full px-2 py-0.5" style={{ color: EARTH, background: `${EARTH}1a` }}>{parsed.redFlags.length}</span>
            </div>
            <ul className="space-y-2">
              {parsed.redFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: CREAM_DIM }}>
                  <span className="mt-0.5 shrink-0" style={{ color: EARTH }}>✕</span>
                  <span className="leading-relaxed min-w-0 break-words" style={{ fontFamily: 'var(--font-fraunces, serif)' }}>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Potential upside */}
        {parsed.positives.length > 0 && (
          <div className="p-4" style={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: SIGNAL_GREEN }} />
              <span className="mono uppercase tracking-[0.18em] text-[0.6rem] font-semibold" style={{ color: SIGNAL_GREEN }}>Potential upside</span>
              <span className="mono text-[0.55rem] rounded-full px-2 py-0.5" style={{ color: SIGNAL_GREEN, background: `${FOREST}22` }}>{parsed.positives.length}</span>
            </div>
            <ul className="space-y-2">
              {parsed.positives.map((positive, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: CREAM_DIM }}>
                  <span className="mt-0.5 shrink-0" style={{ color: SIGNAL_GREEN }}>✓</span>
                  <span className="leading-relaxed min-w-0 break-words" style={{ fontFamily: 'var(--font-fraunces, serif)' }}>{positive}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Verdict / score explanation */}
      {parsed.explanation && (
        <div className="p-4" style={CARD}>
          <div className="flex items-start gap-3">
            <Target className="w-4 h-4 mt-0.5 shrink-0" style={{ color: scoreColors?.text || AMBER }} />
            <div>
              <p className="mono uppercase tracking-[0.2em] text-[0.55rem] mb-1.5" style={{ color: CREAM_FAINT }}>Verdict</p>
              <p className="text-sm leading-relaxed" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}>{parsed.explanation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Resolution Analysis Card Component
 */
function ResolutionAnalysisCard({ analysis }: { analysis: GrokAnalysis }) {
  const parsed = parseResolutionAnalysis(analysis.content, analysis.format);
  const outcome = analysis.votingData?.outcome;
  const scoreColors = parsed.crowdWisdomRating ? getScoreColor(parsed.crowdWisdomRating) : null;

  const outcomeConfig = outcome === 'YesWins'
    ? { icon: '🚀', label: 'YES wins', accent: SIGNAL_GREEN }
    : outcome === 'NoWins'
      ? { icon: '✕', label: 'NO wins', accent: EARTH }
      : { icon: '↩', label: 'Refund', accent: AMBER };

  return (
    <div className="space-y-4 mt-6 pt-6" style={{ borderTop: `1px solid ${HAIR_STRONG}`, color: CREAM }}>
      {/* Header with Outcome Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${outcomeConfig.accent}22` }}>
            <Trophy className="w-4 h-4" style={{ color: outcomeConfig.accent }} />
          </div>
          <div>
            <h4 className="font-semibold text-sm" style={{ color: CREAM }}>Resolution</h4>
            <div className="flex items-center gap-2">
              <span className="mono uppercase tracking-[0.15em] text-[0.55rem] px-2 py-0.5 rounded-full" style={{ background: `${outcomeConfig.accent}1a`, color: outcomeConfig.accent }}>
                {outcomeConfig.icon} {outcomeConfig.label}
              </span>
              <span className="mono text-[0.55rem]" style={{ color: CREAM_FAINT }}>
                {new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        {parsed.crowdWisdomRating && scoreColors && (
          <div className="flex flex-col items-center px-3.5 py-1.5 rounded-lg" style={{ border: `1px solid ${scoreColors.text}55`, background: `${scoreColors.text}14` }}>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold" style={{ color: scoreColors.text }}>{parsed.crowdWisdomRating}</span>
              <span className="text-sm ml-0.5" style={{ color: CREAM_FAINT }}>/10</span>
            </div>
            <span className="mono uppercase tracking-[0.2em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>crowd wisdom</span>
          </div>
        )}
      </div>

      {/* Voting Stats */}
      {analysis.votingData && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: analysis.votingData.totalYesVotes, label: 'YES votes', c: SIGNAL_GREEN },
            { v: analysis.votingData.totalNoVotes, label: 'NO votes', c: EARTH },
            { v: analysis.votingData.totalParticipants, label: 'Total', c: AMBER },
          ].map((s) => (
            <div key={s.label} className="p-3 text-center" style={CARD}>
              <p className="font-bold text-xl" style={{ color: s.c }}>{s.v}</p>
              <p className="mono uppercase tracking-[0.15em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Final Verdict */}
      {parsed.verdict && (
        <div className="pl-3" style={{ borderLeft: `2px solid ${outcomeConfig.accent}` }}>
          <p className="text-sm leading-relaxed" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}>
            {parsed.verdict}
          </p>
        </div>
      )}

      {/* Crowd Analysis */}
      {parsed.crowdAnalysis && (
        <div className="p-4" style={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5" style={{ color: AMBER }} />
            <span className="mono uppercase tracking-[0.18em] text-[0.6rem] font-semibold" style={{ color: AMBER }}>Crowd analysis</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}>
            {parsed.crowdAnalysis}
          </p>
        </div>
      )}

      {/* What's Next */}
      {parsed.whatsNext.length > 0 && (
        <div className="p-4" style={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: AMBER }} />
            <span className="mono uppercase tracking-[0.18em] text-[0.6rem] font-semibold" style={{ color: AMBER }}>What&apos;s next</span>
            <span className="mono text-[0.55rem] rounded-full px-2 py-0.5" style={{ color: AMBER, background: `${AMBER}1a` }}>{parsed.whatsNext.length}</span>
          </div>
          <ul className="space-y-2">
            {parsed.whatsNext.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: CREAM_DIM }}>
                <span className="mono text-[0.6rem] mt-0.5 shrink-0" style={{ color: AMBER }}>{i + 1}</span>
                <span className="leading-relaxed min-w-0 break-words" style={{ fontFamily: 'var(--font-fraunces, serif)' }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Active "generating" state shown while the first roast is being produced.
 * The initial POST verifies external links and then calls Grok, which takes
 * ~5-15s on a cold market — this cycles staged status text so the wait reads
 * as work in progress rather than a hung screen.
 */
function GeneratingRoast() {
  const stages = [
    'Verifying website & links',
    'Checking GitHub & socials',
    'Consulting the AI analyst',
    'Writing the roast',
  ];
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Advance toward the last stage and hold there until generation resolves.
      setStage((s) => (s < stages.length - 1 ? s + 1 : s));
    }, 2800);
    return () => clearInterval(id);
  }, [stages.length]);

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(232,150,96,0.14)', border: `1px solid ${HAIR_STRONG}` }}>
          <Sparkles className="w-6 h-6 animate-pulse" style={{ color: AMBER }} />
        </div>
      </div>
      <div className="flex items-center gap-2" style={{ color: CREAM_DIM }}>
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: AMBER }} />
        <span className="text-sm">{stages[stage]}…</span>
      </div>
      {/* Staged progress dots */}
      <div className="flex items-center gap-1.5">
        {stages.map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: i <= stage ? 24 : 6, background: i <= stage ? AMBER : HAIR_STRONG }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: CREAM_FAINT }}>This can take a few seconds on a fresh market</p>
    </div>
  );
}

/**
 * Main GrokRoast Component - Chat-like history of analyses
 */
export default function GrokRoast({ marketId, resolution, votingData }: GrokRoastProps) {
  const [analyses, setAnalyses] = useState<GrokAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingInitial, setGeneratingInitial] = useState(false);
  const [generatingResolution, setGeneratingResolution] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [hasTriggeredResolution, setHasTriggeredResolution] = useState(false);
  const [showInitialReview, setShowInitialReview] = useState(false);
  const [hasTriggeredInitial, setHasTriggeredInitial] = useState(false);

  // Fetch existing analyses
  useEffect(() => {
    let isMounted = true;

    const fetchAnalyses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get existing analyses
        const response = await fetch(`/api/grok/roast?marketId=${marketId}`);
        const data = await response.json();

        if (!isMounted) return;

        if (data.success && data.data.analyses) {
          setAnalyses(data.data.analyses);

          // If no initial roast exists and we haven't tried yet, generate one
          if (!data.data.hasInitialRoast && !hasTriggeredInitial) {
            setHasTriggeredInitial(true);
            setInitialError(null);
            setGeneratingInitial(true);
            try {
              // authFetch attaches the Privy Bearer token — the
              // /api/grok/roast POST is withAuth-gated, so a plain
              // fetch() always 401s and the on-view roast never generates.
              const postResponse = await authFetch('/api/grok/roast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketId, type: 'initial_roast' }),
              });
              const postData = await postResponse.json();
              if (isMounted && postData.success) {
                setAnalyses(postData.data.allAnalyses);
              } else if (isMounted && !postData.success) {
                console.warn('Failed to generate initial roast:', postData.error);
                setInitialError(postData.error || 'Failed to generate analysis');
              }
            } catch (genErr) {
              console.warn('Failed to generate initial roast:', genErr);
              if (isMounted) {
                setInitialError(genErr instanceof Error ? genErr.message : 'Failed to generate analysis');
              }
            } finally {
              if (isMounted) setGeneratingInitial(false);
            }
          }
        } else if (!data.success) {
          console.warn('Failed to fetch analyses:', data.error);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch analyses');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAnalyses();

    return () => {
      isMounted = false;
    };
  }, [marketId, hasTriggeredInitial]);

  // Generate resolution analysis when market resolves
  useEffect(() => {
    const generateResolutionAnalysis = async () => {
      if (!resolution || resolution === 'Unresolved') return;
      if (!votingData) return;
      if (hasTriggeredResolution) return; // Prevent double trigger
      if (loading) return; // Wait for initial load

      // Check if we already have a resolution analysis in current state
      const hasResolution = analyses.some(a => a.type === 'resolution_analysis');
      if (hasResolution) return;

      // Mark as triggered to prevent race conditions
      setHasTriggeredResolution(true);

      try {
        setGeneratingResolution(true);

        const response = await authFetch('/api/grok/roast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId,
            type: 'resolution_analysis',
            votingData: {
              ...votingData,
              outcome: resolution,
            },
          }),
        });

        const data = await response.json();
        if (data.success) {
          setAnalyses(data.data.allAnalyses);
        }
      } catch (err) {
        console.error('Failed to generate resolution analysis:', err);
        setHasTriggeredResolution(false); // Reset on error to allow retry
      } finally {
        setGeneratingResolution(false);
      }
    };

    if (analyses.length > 0 && !loading) {
      generateResolutionAnalysis();
    }
  }, [marketId, resolution, votingData, analyses, loading, hasTriggeredResolution]);

  // Re-trigger initial generation after a failure. Clearing hasTriggeredInitial
  // re-runs the fetch effect, which GETs (still empty) and POSTs again.
  const retryInitial = () => {
    setInitialError(null);
    setHasTriggeredInitial(false);
  };

  if (loading) {
    // While the first roast is actually being generated, show the staged
    // progress state instead of a generic spinner.
    if (generatingInitial) {
      return <GeneratingRoast />;
    }
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(232,150,96,0.14)', border: `1px solid ${HAIR_STRONG}` }}>
          <Sparkles className="w-5 h-5 animate-pulse" style={{ color: AMBER }} />
        </div>
        <div className="flex items-center gap-2" style={{ color: CREAM_DIM }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading analysis…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-2">
        <AlertTriangle className="w-6 h-6" style={{ color: EARTH }} />
        <p className="text-sm" style={{ color: EARTH }}>{error}</p>
        <p className="text-xs" style={{ color: CREAM_FAINT }}>Analysis unavailable</p>
      </div>
    );
  }

  if (analyses.length === 0) {
    // Still generating (e.g. GET resolved but POST in flight).
    if (generatingInitial) {
      return <GeneratingRoast />;
    }

    // Generation failed — offer a retry instead of a silent dead end.
    if (initialError) {
      return (
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${EARTH}1a`, border: `1px solid ${EARTH}55` }}>
            <AlertTriangle className="w-5 h-5" style={{ color: EARTH }} />
          </div>
          <div className="text-center">
            <p className="text-sm" style={{ color: CREAM_DIM }}>Couldn&apos;t generate the analysis</p>
            <p className="text-xs mt-1" style={{ color: CREAM_FAINT }}>{initialError}</p>
          </div>
          <button
            onClick={retryInitial}
            className="px-4 py-2 rounded-full mono uppercase tracking-[0.18em] text-[0.6rem] transition-colors"
            style={{ border: `1px solid ${AMBER}`, color: AMBER }}
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR_STRONG}` }}>
          <Sparkles className="w-5 h-5" style={{ color: CREAM_FAINT }} />
        </div>
        <div className="text-center">
          <p className="text-sm" style={{ color: CREAM_DIM }}>AI analysis will appear here</p>
          <p className="text-xs mt-1" style={{ color: CREAM_FAINT }}>Generating automatically…</p>
        </div>
      </div>
    );
  }

  // Deduplicate and sort analyses - only keep the most recent of each type
  const deduplicatedAnalyses = analyses.reduce((acc, analysis) => {
    const existing = acc.find(a => a.type === analysis.type);
    if (!existing) {
      acc.push(analysis);
    } else {
      // Keep the more recent one
      const existingDate = new Date(existing.generatedAt).getTime();
      const newDate = new Date(analysis.generatedAt).getTime();
      if (newDate > existingDate) {
        const index = acc.indexOf(existing);
        acc[index] = analysis;
      }
    }
    return acc;
  }, [] as GrokAnalysis[]);

  // Sort analyses by date (oldest first for chat-like flow)
  const sortedAnalyses = deduplicatedAnalyses.sort(
    (a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
  );

  // Check if we have a resolution analysis
  const hasResolution = sortedAnalyses.some(a => a.type === 'resolution_analysis');
  const initialRoast = sortedAnalyses.find(a => a.type === 'initial_roast');
  const resolutionAnalysis = sortedAnalyses.find(a => a.type === 'resolution_analysis');

  return (
    <div className="space-y-4">
      {/* If resolution exists, show it first with collapsible initial review */}
      {hasResolution && resolutionAnalysis ? (
        <>
          {/* Resolution Analysis - Always visible */}
          <ResolutionAnalysisCard analysis={resolutionAnalysis} />

          {/* Initial Review - Collapsible when resolution exists */}
          {initialRoast && (
            <div className="mt-4">
              <button
                onClick={() => setShowInitialReview(!showInitialReview)}
                className="w-full flex items-center justify-between p-3 rounded-xl transition-colors"
                style={CARD}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(232,150,96,0.14)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: AMBER }} />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium" style={{ color: CREAM_DIM }}>Initial AI analysis</span>
                    <p className="mono text-[0.55rem]" style={{ color: CREAM_FAINT }}>
                      {new Date(initialRoast.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono uppercase tracking-[0.15em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>
                    {showInitialReview ? 'Hide' : 'View'}
                  </span>
                  {showInitialReview ? (
                    <ChevronUp className="w-4 h-4" style={{ color: CREAM_FAINT }} />
                  ) : (
                    <ChevronDown className="w-4 h-4" style={{ color: CREAM_FAINT }} />
                  )}
                </div>
              </button>

              {/* Collapsible content */}
              {showInitialReview && (
                <div className="mt-3 p-4 rounded-xl" style={CARD}>
                  <InitialRoastCard analysis={initialRoast} />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* No resolution yet - show analyses in order */
        sortedAnalyses.map((analysis, index) => (
          <div key={index}>
            {analysis.type === 'initial_roast' ? (
              <InitialRoastCard analysis={analysis} />
            ) : (
              <ResolutionAnalysisCard analysis={analysis} />
            )}
          </div>
        ))
      )}

      {/* Loading state for resolution analysis */}
      {generatingResolution && (
        <div className="flex items-center justify-center gap-2 py-4" style={{ color: AMBER }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analyzing resolution…</span>
        </div>
      )}

      {/* Powered by footer */}
      <div className="flex items-center justify-end gap-1.5 pt-2" style={{ borderTop: `1px solid ${HAIR_STRONG}` }}>
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" style={{ color: CREAM_FAINT }} fill="currentColor">
          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L17.5 8 12 11.5 6.5 8 12 4.5zM6 9.5l5 3v6l-5-3v-6zm12 0v6l-5 3v-6l5-3z"/>
        </svg>
        <span className="mono text-[0.5rem] uppercase tracking-[0.15em]" style={{ color: CREAM_FAINT }}>Powered by xAI Grok</span>
      </div>
    </div>
  );
}
