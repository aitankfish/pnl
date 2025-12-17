/**
 * Grok AI Analysis API
 * Generates AI-powered roasts and resolution analyses using xAI's Grok API
 * Enhanced with external data verification (website, GitHub, Twitter)
 * Supports chat-like history with multiple analyses per market
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket, Project } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { fetchExternalData, formatExternalDataForPrompt, ExternalDataResult } from '@/lib/external-data-fetcher';

const logger = createClientLogger();

// Grok API configuration
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-3';

interface GrokAnalysisRequest {
  marketId: string;
  type?: 'initial_roast' | 'resolution_analysis';
  // For resolution analysis
  votingData?: {
    totalYesVotes: number;
    totalNoVotes: number;
    yesPercentage: number;
    totalParticipants: number;
    outcome: string;
  };
}

interface ProjectData {
  name: string;
  description: string;
  category: string;
  projectType: string;
  projectStage: string;
  teamSize: number;
  tokenSymbol: string;
  socialLinks?: Record<string, string>;
  location?: string;
  documentUrls?: string[];
  additionalNotes?: string; // "What This Project Offers"
}

interface VotingData {
  totalYesVotes: number;
  totalNoVotes: number;
  yesPercentage: number;
  totalParticipants: number;
  outcome: string;
}

/**
 * Generate initial roast prompt for Grok with external verification data
 */
function generateInitialRoastPrompt(project: ProjectData, externalData?: ExternalDataResult): string {
  const socialLinksText = project.socialLinks
    ? Object.entries(project.socialLinks)
        .filter(([_, url]) => url)
        .map(([platform, url]) => `${platform}: ${url}`)
        .join('\n')
    : 'None provided';

  const externalVerification = externalData
    ? formatExternalDataForPrompt(externalData)
    : 'External verification not performed';

  const documentUrlsText = project.documentUrls && project.documentUrls.length > 0
    ? project.documentUrls.join('\n')
    : 'None provided';

  return `You are a witty, sarcastic crypto analyst known for your brutally honest but entertaining roasts of crypto projects. Your job is to analyze this project thoroughly and give a humorous but insightful analysis that helps investors make informed decisions.

IMPORTANT: We have automatically verified the project's external links. Use this verification data in your analysis - if a website doesn't exist, GitHub has no commits, or social links are fake, call it out harshly!

=== PROJECT DETAILS ===
- Name: ${project.name}
- Token Symbol: $${project.tokenSymbol}
- Category: ${project.category}
- Type: ${project.projectType}
- Stage: ${project.projectStage}
- Team Size: ${project.teamSize}
- Location: ${project.location || 'Not specified'}

=== PROJECT DESCRIPTION ===
${project.description}

${project.additionalNotes ? `=== WHAT THIS PROJECT OFFERS (Founder's Pitch) ===
${project.additionalNotes}
` : ''}
=== SOCIAL & DOCUMENTATION ===
Social Links:
${socialLinksText}

Documentation URLs:
${documentUrlsText}

=== EXTERNAL VERIFICATION RESULTS ===
${externalVerification}
=== END VERIFICATION ===

YOUR TASK:
1. Give a witty, entertaining roast of this project (2-3 sentences - be creative and reference specifics from their pitch!)
2. Identify 3-4 potential red flags or concerns - USE THE VERIFICATION DATA! If their website is down, GitHub is empty, or socials are fake, these are MAJOR red flags
3. Identify 2-3 potential positives (if any exist - verified working links, active GitHub, solid team claims, interesting tech)
4. Give a "Legit Score" from 1-10 (1 = obvious scam, 10 = actually promising)

SCORING GUIDELINES:
- Website doesn't exist or is a template: -2 points
- GitHub repo doesn't exist or has <10 commits: -2 points
- GitHub repo is a fork with no original work: -3 points
- No activity on GitHub in 90+ days: -1 point
- Social links are fake/non-existent: -2 points
- Vague or buzzword-heavy pitch with no specifics: -1 point
- All links verified and active: +2 points
- Active GitHub with multiple contributors: +2 points
- Clear, specific value proposition: +1 point
- Experienced team (if verifiable): +1 point

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

**THE ROAST:**
[Your witty roast here - reference their pitch and verification findings! Make it memorable.]

**RED FLAGS:**
- [Flag 1 - be specific about verification failures or concerning claims]
- [Flag 2]
- [Flag 3]
- [Flag 4 if applicable]

**POTENTIAL UPSIDE:**
- [Positive 1 - mention verified strengths or genuinely interesting aspects]
- [Positive 2]
- [Positive 3 if applicable]

**LEGIT SCORE: X/10**
[2-3 sentence explanation summarizing why you gave this score, referencing key verification findings and pitch analysis]

Be entertaining but genuinely helpful. Analyze their pitch critically - vague promises and buzzwords should be called out. If the verification data shows problems, be BRUTAL about it. Scammers hate being exposed!`;
}

/**
 * Generate resolution analysis prompt with voting data
 */
function generateResolutionPrompt(
  project: ProjectData,
  votingData: VotingData,
  initialRoast?: string
): string {
  const outcomeEmoji = votingData.outcome === 'YesWins' ? '🚀' : votingData.outcome === 'NoWins' ? '💀' : '💸';
  const outcomeText = votingData.outcome === 'YesWins'
    ? 'YES WINS - Token launched!'
    : votingData.outcome === 'NoWins'
      ? 'NO WINS - Project rejected'
      : 'REFUND - Target not reached';

  return `You are a witty crypto analyst providing a post-mortem analysis of a prediction market that just resolved.

PROJECT: ${project.name} ($${project.tokenSymbol})
Category: ${project.category} | Stage: ${project.projectStage}

=== MARKET RESOLUTION ===
${outcomeEmoji} OUTCOME: ${outcomeText}

VOTING RESULTS:
- Total Participants: ${votingData.totalParticipants}
- YES Votes: ${votingData.totalYesVotes} (${votingData.yesPercentage}%)
- NO Votes: ${votingData.totalNoVotes} (${100 - votingData.yesPercentage}%)
- Final Decision: ${votingData.outcome}

${initialRoast ? `=== YOUR INITIAL ANALYSIS (for reference) ===
${initialRoast}
=== END INITIAL ANALYSIS ===` : ''}

YOUR TASK:
Provide a resolution summary that:
1. Announces the outcome dramatically (be theatrical!)
2. Analyzes what the crowd's decision means
3. Gives a "Crowd Wisdom Rating" - was this a smart collective decision?
4. If YES won: What should token holders watch for?
5. If NO won: Was the crowd right to reject this?
6. If REFUND: Why didn't this gain traction?

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

**${outcomeEmoji} FINAL VERDICT:**
[Dramatic 1-2 sentence announcement of the outcome]

**CROWD ANALYSIS:**
[2-3 sentences analyzing what the voting pattern reveals about community sentiment]

**CROWD WISDOM RATING: X/10**
[Was this a smart collective decision? Explain briefly]

**WHAT'S NEXT:**
${votingData.outcome === 'YesWins'
  ? '- [What token holders should watch for]\n- [Potential risks going forward]'
  : votingData.outcome === 'NoWins'
    ? '- [Why the crowd rejected this]\n- [What the project could have done better]'
    : '- [Why this failed to gain traction]\n- [What this says about market appetite]'}

Be entertaining but insightful. This is the final chapter of this project's prediction market story!`;
}

/**
 * Call Grok API to generate analysis
 */
async function callGrokAPI(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;

  if (!apiKey) {
    logger.error('GROK_API_KEY environment variable is not configured');
    throw new Error('AI analysis service is not configured. Please contact support.');
  }

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt || 'You are a witty crypto analyst who provides entertaining but insightful analysis.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Grok API error', { status: response.status, error: errorText });
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'No analysis generated';
}

/**
 * POST /api/grok/roast
 * Generate an analysis for a market (initial roast or resolution analysis)
 */
export async function POST(request: NextRequest) {
  try {
    const body: GrokAnalysisRequest = await request.json();
    const { marketId, type = 'initial_roast', votingData } = body;

    if (!marketId) {
      return NextResponse.json(
        { success: false, error: 'marketId is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get market and project data
    const market = await PredictionMarket.findById(marketId).lean();

    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    // Check if this type of analysis already exists
    const existingAnalyses = market.grokAnalyses || [];
    const existingOfType = existingAnalyses.find((a: any) => a.type === type);

    if (existingOfType) {
      return NextResponse.json({
        success: true,
        data: {
          analysis: existingOfType,
          allAnalyses: existingAnalyses,
          cached: true,
        },
      });
    }

    // For backward compatibility: check legacy grokRoast field for initial roast
    if (type === 'initial_roast' && market.grokRoast?.content && existingAnalyses.length === 0) {
      // Migrate legacy roast to new format
      const migratedAnalysis = {
        type: 'initial_roast',
        content: market.grokRoast.content,
        generatedAt: market.grokRoast.generatedAt || new Date(),
        model: market.grokRoast.model || GROK_MODEL,
      };

      await PredictionMarket.updateOne(
        { _id: marketId },
        { $push: { grokAnalyses: migratedAnalysis } }
      );

      return NextResponse.json({
        success: true,
        data: {
          analysis: migratedAnalysis,
          allAnalyses: [migratedAnalysis],
          cached: true,
          migrated: true,
        },
      });
    }

    // Get project data
    const project = await Project.findById(market.projectId).lean();

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Convert socialLinks Map to object
    const socialLinksObj: Record<string, string> = {};
    if (project.socialLinks) {
      if (project.socialLinks instanceof Map) {
        project.socialLinks.forEach((value: string, key: string) => {
          socialLinksObj[key] = value;
        });
      } else if (typeof project.socialLinks === 'object') {
        Object.assign(socialLinksObj, project.socialLinks);
      }
    }

    // Get additionalNotes from market's cached metadata if available
    const additionalNotes = market.cachedMetadata?.additionalNotes
      || (market as any).metadata?.additionalNotes
      || '';

    const projectData: ProjectData = {
      name: project.name,
      description: project.description,
      category: project.category,
      projectType: project.projectType,
      projectStage: project.projectStage,
      teamSize: project.teamSize,
      tokenSymbol: project.tokenSymbol,
      socialLinks: socialLinksObj,
      location: project.location,
      documentUrls: project.documentUrls,
      additionalNotes: additionalNotes,
    };

    let prompt: string;
    let analysisContent: string;

    if (type === 'initial_roast') {
      // Fetch external data for verification
      logger.info('Fetching external data for verification', { marketId, projectName: project.name });
      let externalData: ExternalDataResult | undefined;
      try {
        externalData = await fetchExternalData(socialLinksObj);
        logger.info('External data fetched', {
          marketId,
          hasWebsite: !!externalData.website,
          hasGithub: !!externalData.github,
          hasTwitter: !!externalData.twitter,
        });
      } catch (error) {
        logger.warn('Failed to fetch external data', {
          marketId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      prompt = generateInitialRoastPrompt(projectData, externalData);
      logger.info('Generating initial roast', { marketId, projectName: project.name });
      analysisContent = await callGrokAPI(prompt, 'You are a witty crypto analyst who roasts projects with humor while providing genuine insights. You have access to external verification data and should use it to expose fake or suspicious projects.');
    } else if (type === 'resolution_analysis') {
      if (!votingData) {
        return NextResponse.json(
          { success: false, error: 'votingData is required for resolution analysis' },
          { status: 400 }
        );
      }

      // Get initial roast for context
      const initialRoast = existingAnalyses.find((a: any) => a.type === 'initial_roast')?.content
        || market.grokRoast?.content;

      prompt = generateResolutionPrompt(projectData, votingData, initialRoast);
      logger.info('Generating resolution analysis', { marketId, outcome: votingData.outcome });
      analysisContent = await callGrokAPI(prompt, 'You are a witty crypto analyst providing post-mortem analysis of prediction markets. Be theatrical but insightful.');
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid analysis type' },
        { status: 400 }
      );
    }

    // Create new analysis object
    const newAnalysis = {
      type,
      content: analysisContent,
      generatedAt: new Date(),
      model: GROK_MODEL,
      ...(type === 'resolution_analysis' && votingData ? { votingData } : {}),
    };

    // Save to database using atomic operation to prevent duplicates
    // Only add if no analysis of this type exists
    const updateResult = await PredictionMarket.updateOne(
      {
        _id: marketId,
        'grokAnalyses.type': { $ne: type }, // Only update if type doesn't exist
      },
      {
        $push: { grokAnalyses: newAnalysis },
        // Also update legacy field for initial roast (backward compatibility)
        ...(type === 'initial_roast' ? {
          $set: {
            grokRoast: {
              content: analysisContent,
              generatedAt: new Date(),
              model: GROK_MODEL,
            }
          }
        } : {})
      }
    );

    // If no documents were modified, it means the analysis type already exists
    // Fetch and return the existing one
    if (updateResult.modifiedCount === 0) {
      const existingMarket = await PredictionMarket.findById(marketId).select('grokAnalyses').lean();
      const existingAnalysis = existingMarket?.grokAnalyses?.find((a: any) => a.type === type);

      logger.info('Analysis already exists, returning cached version', { marketId, type });

      return NextResponse.json({
        success: true,
        data: {
          analysis: existingAnalysis || newAnalysis,
          allAnalyses: existingMarket?.grokAnalyses || [newAnalysis],
          cached: true,
        },
      });
    }

    // Get updated analyses
    const updatedMarket = await PredictionMarket.findById(marketId).select('grokAnalyses').lean();

    logger.info('Grok analysis generated and saved', { marketId, type });

    return NextResponse.json({
      success: true,
      data: {
        analysis: newAnalysis,
        allAnalyses: updatedMarket?.grokAnalyses || [newAnalysis],
        cached: false,
      },
    });
  } catch (error) {
    logger.error('Failed to generate Grok analysis', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate analysis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/grok/roast?marketId=xxx
 * Get all analyses for a market
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get('marketId');

    if (!marketId) {
      return NextResponse.json(
        { success: false, error: 'marketId is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get market with analyses
    const market = await PredictionMarket.findById(marketId)
      .select('grokRoast grokAnalyses resolution')
      .lean();

    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    // Combine legacy roast with new analyses
    let analyses: any[] = market.grokAnalyses || [];

    // If we have legacy roast but no analyses, include it
    if (market.grokRoast?.content && analyses.length === 0) {
      analyses = [{
        type: 'initial_roast',
        content: market.grokRoast.content,
        generatedAt: market.grokRoast.generatedAt || new Date(),
        model: market.grokRoast.model || GROK_MODEL,
      }];
    }

    // Deduplicate analyses - keep only the most recent of each type
    const deduplicatedAnalyses = analyses.reduce((acc: any[], analysis: any) => {
      const existing = acc.find((a: any) => a.type === analysis.type);
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
    }, []);

    return NextResponse.json({
      success: true,
      data: {
        analyses: deduplicatedAnalyses,
        resolution: market.resolution,
        hasInitialRoast: deduplicatedAnalyses.some((a: any) => a.type === 'initial_roast'),
        hasResolutionAnalysis: deduplicatedAnalyses.some((a: any) => a.type === 'resolution_analysis'),
      },
    });
  } catch (error) {
    logger.error('Failed to get Grok analyses', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get analyses',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
