'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, AlertTriangle, TrendingUp, Target, MessageSquare, Trophy, Users } from 'lucide-react';

interface GrokAnalysis {
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
 * Parse initial roast content into sections
 */
function parseInitialRoast(content: string): {
  roast: string;
  redFlags: string[];
  positives: string[];
  legitScore: string;
  explanation: string;
} {
  const result = {
    roast: '',
    redFlags: [] as string[],
    positives: [] as string[],
    legitScore: '',
    explanation: '',
  };

  // Extract THE ROAST section
  const roastMatch = content.match(/\*\*THE ROAST:\*\*\s*([\s\S]*?)(?=\*\*RED FLAGS:|$)/i);
  if (roastMatch) {
    result.roast = roastMatch[1].trim();
  }

  // Extract RED FLAGS section
  const redFlagsMatch = content.match(/\*\*RED FLAGS:\*\*\s*([\s\S]*?)(?=\*\*POTENTIAL UPSIDE:|$)/i);
  if (redFlagsMatch) {
    result.redFlags = redFlagsMatch[1]
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  // Extract POTENTIAL UPSIDE section
  const positivesMatch = content.match(/\*\*POTENTIAL UPSIDE:\*\*\s*([\s\S]*?)(?=\*\*LEGIT SCORE:|$)/i);
  if (positivesMatch) {
    result.positives = positivesMatch[1]
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  // Extract LEGIT SCORE
  const scoreMatch = content.match(/\*\*LEGIT SCORE:\s*(\d+)\/10\*\*/i);
  if (scoreMatch) {
    result.legitScore = scoreMatch[1];
  }

  // Extract explanation after score
  const explanationMatch = content.match(/\*\*LEGIT SCORE:\s*\d+\/10\*\*\s*([\s\S]*?)$/i);
  if (explanationMatch) {
    result.explanation = explanationMatch[1].trim();
  }

  return result;
}

/**
 * Parse resolution analysis content into sections
 */
function parseResolutionAnalysis(content: string): {
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

  // Extract FINAL VERDICT
  const verdictMatch = content.match(/\*\*[🚀💀💸]?\s*FINAL VERDICT:\*\*\s*([\s\S]*?)(?=\*\*CROWD ANALYSIS:|$)/i);
  if (verdictMatch) {
    result.verdict = verdictMatch[1].trim();
  }

  // Extract CROWD ANALYSIS
  const crowdMatch = content.match(/\*\*CROWD ANALYSIS:\*\*\s*([\s\S]*?)(?=\*\*CROWD WISDOM RATING:|$)/i);
  if (crowdMatch) {
    result.crowdAnalysis = crowdMatch[1].trim();
  }

  // Extract CROWD WISDOM RATING
  const ratingMatch = content.match(/\*\*CROWD WISDOM RATING:\s*(\d+)\/10\*\*/i);
  if (ratingMatch) {
    result.crowdWisdomRating = ratingMatch[1];
  }

  // Extract WHAT'S NEXT
  const nextMatch = content.match(/\*\*WHAT'S NEXT:\*\*\s*([\s\S]*?)$/i);
  if (nextMatch) {
    result.whatsNext = nextMatch[1]
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  return result;
}

/**
 * Get score color based on score value
 */
function getScoreColor(score: string): string {
  const numScore = parseInt(score, 10);
  if (numScore >= 7) return 'text-green-400 border-green-400/30 bg-green-500/20';
  if (numScore >= 4) return 'text-yellow-400 border-yellow-400/30 bg-yellow-500/20';
  return 'text-red-400 border-red-400/30 bg-red-500/20';
}

/**
 * Initial Roast Card Component
 */
function InitialRoastCard({ analysis }: { analysis: GrokAnalysis }) {
  const parsed = parseInitialRoast(analysis.content);

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-orange-900/20 border-purple-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>Initial Analysis</span>
          </CardTitle>
          {parsed.legitScore && (
            <Badge className={`text-lg font-bold ${getScoreColor(parsed.legitScore)}`}>
              <Target className="w-4 h-4 mr-1" />
              {parsed.legitScore}/10
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {new Date(analysis.generatedAt).toLocaleDateString()} • Pre-voting analysis
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* The Roast */}
        {parsed.roast && (
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
            <p className="text-white italic text-sm leading-relaxed">
              &ldquo;{parsed.roast}&rdquo;
            </p>
          </div>
        )}

        {/* Red Flags */}
        {parsed.redFlags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-semibold text-sm">Red Flags</span>
            </div>
            <ul className="space-y-1 pl-6">
              {parsed.redFlags.map((flag, i) => (
                <li key={i} className="text-gray-300 text-sm list-disc">
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Potential Upside */}
        {parsed.positives.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-green-400">
              <TrendingUp className="w-4 h-4" />
              <span className="font-semibold text-sm">Potential Upside</span>
            </div>
            <ul className="space-y-1 pl-6">
              {parsed.positives.map((positive, i) => (
                <li key={i} className="text-gray-300 text-sm list-disc">
                  {positive}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Score Explanation */}
        {parsed.explanation && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-gray-400 text-xs">
              {parsed.explanation}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Resolution Analysis Card Component
 */
function ResolutionAnalysisCard({ analysis }: { analysis: GrokAnalysis }) {
  const parsed = parseResolutionAnalysis(analysis.content);
  const outcome = analysis.votingData?.outcome;
  const outcomeColor = outcome === 'YesWins'
    ? 'from-green-900/30 via-emerald-900/20 to-cyan-900/20 border-green-500/30'
    : outcome === 'NoWins'
      ? 'from-red-900/30 via-pink-900/20 to-orange-900/20 border-red-500/30'
      : 'from-yellow-900/30 via-orange-900/20 to-red-900/20 border-yellow-500/30';

  return (
    <Card className={`bg-gradient-to-br ${outcomeColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span>Resolution Summary</span>
          </CardTitle>
          {parsed.crowdWisdomRating && (
            <Badge className={`text-lg font-bold ${getScoreColor(parsed.crowdWisdomRating)}`}>
              <Users className="w-4 h-4 mr-1" />
              {parsed.crowdWisdomRating}/10
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {new Date(analysis.generatedAt).toLocaleDateString()} • Post-resolution analysis
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Voting Stats */}
        {analysis.votingData && (
          <div className="bg-black/30 rounded-lg p-3 border border-white/10">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-green-400 font-bold text-lg">{analysis.votingData.totalYesVotes}</p>
                <p className="text-xs text-gray-500">YES Votes</p>
              </div>
              <div>
                <p className="text-red-400 font-bold text-lg">{analysis.votingData.totalNoVotes}</p>
                <p className="text-xs text-gray-500">NO Votes</p>
              </div>
              <div>
                <p className="text-cyan-400 font-bold text-lg">{analysis.votingData.totalParticipants}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>
        )}

        {/* Final Verdict */}
        {parsed.verdict && (
          <div className="bg-black/30 rounded-lg p-4 border border-yellow-500/20">
            <p className="text-white font-semibold text-sm leading-relaxed">
              {parsed.verdict}
            </p>
          </div>
        )}

        {/* Crowd Analysis */}
        {parsed.crowdAnalysis && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-cyan-400">
              <Users className="w-4 h-4" />
              <span className="font-semibold text-sm">Crowd Analysis</span>
            </div>
            <p className="text-gray-300 text-sm pl-6">
              {parsed.crowdAnalysis}
            </p>
          </div>
        )}

        {/* What's Next */}
        {parsed.whatsNext.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-purple-400">
              <TrendingUp className="w-4 h-4" />
              <span className="font-semibold text-sm">What&apos;s Next</span>
            </div>
            <ul className="space-y-1 pl-6">
              {parsed.whatsNext.map((item, i) => (
                <li key={i} className="text-gray-300 text-sm list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Main GrokRoast Component - Chat-like history of analyses
 */
export default function GrokRoast({ marketId, resolution, votingData }: GrokRoastProps) {
  const [analyses, setAnalyses] = useState<GrokAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingResolution, setGeneratingResolution] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing analyses
  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setLoading(true);

        // Get existing analyses
        const response = await fetch(`/api/grok/roast?marketId=${marketId}`);
        const data = await response.json();

        if (data.success && data.data.analyses) {
          setAnalyses(data.data.analyses);

          // If no initial roast exists, generate one
          if (!data.data.hasInitialRoast) {
            const postResponse = await fetch('/api/grok/roast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ marketId, type: 'initial_roast' }),
            });
            const postData = await postResponse.json();
            if (postData.success) {
              setAnalyses(postData.data.allAnalyses);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analyses');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [marketId]);

  // Generate resolution analysis when market resolves
  useEffect(() => {
    const generateResolutionAnalysis = async () => {
      if (!resolution || resolution === 'Unresolved') return;
      if (!votingData) return;

      // Check if we already have a resolution analysis
      const hasResolution = analyses.some(a => a.type === 'resolution_analysis');
      if (hasResolution) return;

      try {
        setGeneratingResolution(true);

        const response = await fetch('/api/grok/roast', {
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
      } finally {
        setGeneratingResolution(false);
      }
    };

    if (analyses.length > 0) {
      generateResolutionAnalysis();
    }
  }, [marketId, resolution, votingData, analyses]);

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-orange-900/20 border-purple-500/30">
        <CardContent className="py-12 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
            <div className="absolute inset-0 blur-xl bg-purple-500/30 animate-pulse" />
          </div>
          <div className="flex items-center space-x-2 text-purple-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading Grok analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-500/30">
        <CardContent className="py-8 text-center">
          <p className="text-red-400">{error}</p>
          <p className="text-gray-500 text-sm mt-2">Analysis unavailable</p>
        </CardContent>
      </Card>
    );
  }

  if (analyses.length === 0) {
    return (
      <Card className="bg-gray-900/50 border-gray-700/50">
        <CardContent className="py-8 text-center">
          <p className="text-gray-400">No analysis available yet</p>
        </CardContent>
      </Card>
    );
  }

  // Sort analyses by date (oldest first for chat-like flow)
  const sortedAnalyses = [...analyses].sort(
    (a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
  );

  return (
    <div className="space-y-4">
      {/* Chat-like header */}
      <div className="flex items-center space-x-2 text-gray-400">
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm">Grok AI Analysis History</span>
      </div>

      {/* Analysis cards */}
      {sortedAnalyses.map((analysis, index) => (
        <div key={index} className="relative">
          {/* Connection line for chat effect */}
          {index > 0 && (
            <div className="absolute left-6 -top-4 w-0.5 h-4 bg-gradient-to-b from-purple-500/50 to-transparent" />
          )}

          {analysis.type === 'initial_roast' ? (
            <InitialRoastCard analysis={analysis} />
          ) : (
            <ResolutionAnalysisCard analysis={analysis} />
          )}
        </div>
      ))}

      {/* Loading state for resolution analysis */}
      {generatingResolution && (
        <Card className="bg-gradient-to-br from-yellow-900/20 via-orange-900/20 to-red-900/20 border-yellow-500/30">
          <CardContent className="py-8 flex flex-col items-center justify-center space-y-3">
            <div className="flex items-center space-x-2 text-yellow-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Grok is analyzing the resolution...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Powered by footer */}
      <div className="text-right">
        <span className="text-xs text-gray-600">Powered by xAI Grok</span>
      </div>
    </div>
  );
}
