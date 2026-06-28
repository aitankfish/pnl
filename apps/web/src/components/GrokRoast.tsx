'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertTriangle, TrendingUp, Target, Trophy, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';

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
 * Get score color based on score value
 */
function getScoreColor(score: string): { text: string; bg: string; ring: string; glow: string } {
  const numScore = parseInt(score, 10);
  if (numScore >= 7) return {
    text: 'text-green-400',
    bg: 'bg-green-500/20',
    ring: 'ring-green-500/50',
    glow: 'shadow-green-500/30'
  };
  if (numScore >= 4) return {
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    ring: 'ring-yellow-500/50',
    glow: 'shadow-yellow-500/30'
  };
  return {
    text: 'text-red-400',
    bg: 'bg-red-500/20',
    ring: 'ring-red-500/50',
    glow: 'shadow-red-500/30'
  };
}

/**
 * Initial Roast Card Component
 */
function InitialRoastCard({ analysis }: { analysis: GrokAnalysis }) {
  const parsed = parseInitialRoast(analysis.content, analysis.format);
  const scoreColors = parsed.legitScore ? getScoreColor(parsed.legitScore) : null;

  return (
    <div className="space-y-4">
      {/* Header with Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-white font-bold text-base">AI Analysis</h4>
            <p className="text-xs text-gray-500">
              {new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        {parsed.legitScore && scoreColors && (
          <div className={`flex flex-col items-center px-4 py-2 rounded-xl ${scoreColors.bg} ring-1 ${scoreColors.ring} shadow-lg ${scoreColors.glow}`}>
            <div className="flex items-baseline">
              <span className={`text-2xl font-black ${scoreColors.text}`}>{parsed.legitScore}</span>
              <span className="text-sm text-gray-400 ml-0.5">/10</span>
            </div>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Legit Score</span>
          </div>
        )}
      </div>

      {/* The Roast Quote */}
      {parsed.roast && (
        <div className="relative bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-transparent rounded-xl p-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 via-pink-500 to-orange-500 rounded-full" />
          <p className="text-gray-200 italic text-sm leading-relaxed pl-3">
            &ldquo;{parsed.roast}&rdquo;
          </p>
        </div>
      )}

      {/* Red Flags & Positives */}
      <div className="space-y-3">
        {/* Verified — deterministic, automated checks. Ground truth that stands
            on its own, independent of the AI's read, so it leads. */}
        {parsed.verifiedFacts.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-xs">✓</span>
              </div>
              <span className="font-bold text-sm text-emerald-400">Verified</span>
              <span className="text-[10px] text-emerald-400/50 uppercase tracking-wider">automated checks</span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {parsed.verifiedFacts.map((fact, i) => (
                <li key={i} className="text-xs text-gray-300 bg-black/20 border border-emerald-500/10 rounded-full px-3 py-1">
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags */}
        {parsed.redFlags.length > 0 && (
          <div className="bg-gradient-to-br from-red-500/10 to-red-900/5 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </div>
              <span className="font-bold text-sm text-red-400">Red Flags</span>
              <span className="text-xs text-red-400/60 bg-red-500/10 px-2 py-0.5 rounded-full">{parsed.redFlags.length}</span>
            </div>
            <ul className="space-y-2">
              {parsed.redFlags.map((flag, i) => (
                <li key={i} className="flex items-start space-x-3 text-sm text-gray-300 bg-black/20 rounded-lg p-2.5">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-400 text-xs">✕</span>
                  </span>
                  <span className="leading-relaxed min-w-0 break-words">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Potential Upside */}
        {parsed.positives.length > 0 && (
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-900/5 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              </div>
              <span className="font-bold text-sm text-green-400">Potential Upside</span>
              <span className="text-xs text-green-400/60 bg-green-500/10 px-2 py-0.5 rounded-full">{parsed.positives.length}</span>
            </div>
            <ul className="space-y-2">
              {parsed.positives.map((positive, i) => (
                <li key={i} className="flex items-start space-x-3 text-sm text-gray-300 bg-black/20 rounded-lg p-2.5">
                  <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </span>
                  <span className="leading-relaxed min-w-0 break-words">{positive}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Score Explanation */}
      {parsed.explanation && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="flex items-start space-x-3">
            <div className={`w-8 h-8 rounded-lg ${scoreColors?.bg || 'bg-gray-500/20'} flex items-center justify-center flex-shrink-0`}>
              <Target className={`w-4 h-4 ${scoreColors?.text || 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Verdict</p>
              <p className="text-gray-300 text-sm leading-relaxed">{parsed.explanation}</p>
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
    ? { icon: '🚀', label: 'YES Wins', color: 'from-green-500 to-emerald-500', textColor: 'text-green-400', bgColor: 'bg-green-500/10' }
    : outcome === 'NoWins'
      ? { icon: '❌', label: 'NO Wins', color: 'from-red-500 to-pink-500', textColor: 'text-red-400', bgColor: 'bg-red-500/10' }
      : { icon: '💸', label: 'Refund', color: 'from-yellow-500 to-orange-500', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10' };

  return (
    <div className="space-y-4 mt-6 pt-6 border-t border-white/10">
      {/* Header with Outcome Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${outcomeConfig.color} flex items-center justify-center shadow-lg`}>
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-white font-bold text-base">Resolution</h4>
            <div className="flex items-center space-x-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${outcomeConfig.bgColor} ${outcomeConfig.textColor} font-medium`}>
                {outcomeConfig.icon} {outcomeConfig.label}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        {parsed.crowdWisdomRating && scoreColors && (
          <div className={`flex flex-col items-center px-4 py-2 rounded-xl ${scoreColors.bg} ring-1 ${scoreColors.ring} shadow-lg ${scoreColors.glow}`}>
            <div className="flex items-baseline">
              <span className={`text-2xl font-black ${scoreColors.text}`}>{parsed.crowdWisdomRating}</span>
              <span className="text-sm text-gray-400 ml-0.5">/10</span>
            </div>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Crowd Wisdom</span>
          </div>
        )}
      </div>

      {/* Voting Stats */}
      {analysis.votingData && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-green-500/15 to-green-900/5 border border-green-500/30 rounded-xl p-3 text-center">
            <p className="text-green-400 font-black text-xl">{analysis.votingData.totalYesVotes}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider">YES Votes</p>
          </div>
          <div className="bg-gradient-to-br from-red-500/15 to-red-900/5 border border-red-500/30 rounded-xl p-3 text-center">
            <p className="text-red-400 font-black text-xl">{analysis.votingData.totalNoVotes}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider">NO Votes</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-500/15 to-cyan-900/5 border border-cyan-500/30 rounded-xl p-3 text-center">
            <p className="text-cyan-400 font-black text-xl">{analysis.votingData.totalParticipants}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total</p>
          </div>
        </div>
      )}

      {/* Final Verdict */}
      {parsed.verdict && (
        <div className={`relative bg-gradient-to-r ${outcomeConfig.bgColor} to-transparent rounded-xl p-4`}>
          <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${outcomeConfig.color} rounded-full`} />
          <p className="text-gray-200 font-medium text-sm leading-relaxed pl-3">
            {parsed.verdict}
          </p>
        </div>
      )}

      {/* Crowd Analysis */}
      {parsed.crowdAnalysis && (
        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-900/5 border border-cyan-500/20 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="font-bold text-sm text-cyan-400">Crowd Analysis</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            {parsed.crowdAnalysis}
          </p>
        </div>
      )}

      {/* What's Next */}
      {parsed.whatsNext.length > 0 && (
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="font-bold text-sm text-purple-400">What&apos;s Next</span>
            <span className="text-xs text-purple-400/60 bg-purple-500/10 px-2 py-0.5 rounded-full">{parsed.whatsNext.length}</span>
          </div>
          <ul className="space-y-2">
            {parsed.whatsNext.map((item, i) => (
              <li key={i} className="flex items-start space-x-3 text-sm text-gray-300 bg-black/20 rounded-lg p-2.5">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-purple-400 text-xs">{i + 1}</span>
                </span>
                <span className="leading-relaxed min-w-0 break-words">{item}</span>
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
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Sparkles className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div className="absolute inset-0 blur-xl bg-purple-500/30 animate-pulse" />
      </div>
      <div className="flex items-center space-x-2 text-gray-300">
        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
        <span className="text-sm font-medium">{stages[stage]}…</span>
      </div>
      {/* Staged progress dots */}
      <div className="flex items-center space-x-1.5">
        {stages.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i <= stage ? 'w-6 bg-purple-400' : 'w-1.5 bg-gray-700'
            }`}
          />
        ))}
      </div>
      <p className="text-gray-600 text-xs">This can take a few seconds on a fresh market</p>
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
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="absolute inset-0 blur-xl bg-purple-500/20 animate-pulse" />
        </div>
        <div className="flex items-center space-x-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading analysis...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-2">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        <p className="text-red-400 text-sm">{error}</p>
        <p className="text-gray-600 text-xs">Analysis unavailable</p>
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
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-gray-300 text-sm">Couldn&apos;t generate the analysis</p>
            <p className="text-gray-600 text-xs mt-1">{initialError}</p>
          </div>
          <button
            onClick={retryInitial}
            className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-sm font-medium transition-all"
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-gray-500" />
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-sm">AI analysis will appear here</p>
          <p className="text-gray-600 text-xs mt-1">Generating automatically...</p>
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
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-gray-300">Initial AI Analysis</span>
                    <p className="text-xs text-gray-500">
                      {new Date(initialRoast.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 group-hover:text-gray-400">
                    {showInitialReview ? 'Hide' : 'View'}
                  </span>
                  {showInitialReview ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Collapsible content */}
              {showInitialReview && (
                <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10">
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
        <div className="flex items-center justify-center space-x-2 py-4 text-yellow-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analyzing resolution...</span>
        </div>
      )}

      {/* Powered by footer */}
      <div className="flex items-center justify-end space-x-1.5 pt-2 border-t border-white/5">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-600" fill="currentColor">
          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L17.5 8 12 11.5 6.5 8 12 4.5zM6 9.5l5 3v6l-5-3v-6zm12 0v6l-5 3v-6l5-3z"/>
        </svg>
        <span className="text-[10px] text-gray-600">Powered by xAI Grok</span>
      </div>
    </div>
  );
}
