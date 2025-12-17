'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, AlertTriangle, TrendingUp, Target } from 'lucide-react';

interface GrokRoastProps {
  marketId: string;
  cachedRoast?: {
    content: string;
    generatedAt: string;
    model: string;
  } | null;
}

interface RoastData {
  roast: string;
  generatedAt: string;
  model: string;
  cached?: boolean;
}

/**
 * Parse roast content into sections
 */
function parseRoast(content: string): {
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
 * Get score color based on legit score
 */
function getScoreColor(score: string): string {
  const numScore = parseInt(score, 10);
  if (numScore >= 7) return 'text-green-400 border-green-400/30 bg-green-500/20';
  if (numScore >= 4) return 'text-yellow-400 border-yellow-400/30 bg-yellow-500/20';
  return 'text-red-400 border-red-400/30 bg-red-500/20';
}

export default function GrokRoast({ marketId, cachedRoast }: GrokRoastProps) {
  const [roastData, setRoastData] = useState<RoastData | null>(
    cachedRoast
      ? { roast: cachedRoast.content, generatedAt: cachedRoast.generatedAt, model: cachedRoast.model }
      : null
  );
  const [loading, setLoading] = useState(!cachedRoast);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we already have cached data, don't fetch again
    if (cachedRoast) return;

    const fetchRoast = async () => {
      try {
        setLoading(true);

        // First try to get existing roast
        const getResponse = await fetch(`/api/grok/roast?marketId=${marketId}`);
        const getData = await getResponse.json();

        if (getData.success && getData.data) {
          setRoastData({
            roast: getData.data.roast,
            generatedAt: getData.data.generatedAt,
            model: getData.data.model,
          });
          setLoading(false);
          return;
        }

        // No existing roast, generate new one
        const postResponse = await fetch('/api/grok/roast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketId }),
        });

        const postData = await postResponse.json();

        if (postData.success) {
          setRoastData({
            roast: postData.data.roast,
            generatedAt: postData.data.generatedAt,
            model: postData.data.model,
          });
        } else {
          setError(postData.error || 'Failed to generate roast');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch roast');
      } finally {
        setLoading(false);
      }
    };

    fetchRoast();
  }, [marketId, cachedRoast]);

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
            <span>Grok is roasting this project...</span>
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
          <p className="text-gray-500 text-sm mt-2">Roast unavailable at this time</p>
        </CardContent>
      </Card>
    );
  }

  if (!roastData) {
    return (
      <Card className="bg-gray-900/50 border-gray-700/50">
        <CardContent className="py-8 text-center">
          <p className="text-gray-400">No roast available</p>
        </CardContent>
      </Card>
    );
  }

  const parsed = parseRoast(roastData.roast);

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-orange-900/20 border-purple-500/30 overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg sm:text-xl text-white flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>Grok AI Analysis</span>
          </CardTitle>
          {parsed.legitScore && (
            <Badge className={`text-lg font-bold ${getScoreColor(parsed.legitScore)}`}>
              <Target className="w-4 h-4 mr-1" />
              {parsed.legitScore}/10
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Powered by xAI Grok
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* The Roast */}
        {parsed.roast && (
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
            <p className="text-white italic text-sm sm:text-base leading-relaxed">
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
            <p className="text-gray-400 text-xs sm:text-sm">
              {parsed.explanation}
            </p>
          </div>
        )}

        {/* Timestamp */}
        <div className="text-right">
          <span className="text-xs text-gray-600">
            Generated {new Date(roastData.generatedAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
