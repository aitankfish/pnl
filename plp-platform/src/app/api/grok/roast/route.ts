/**
 * Grok AI Roast API
 * Generates AI-powered roasts/analysis of projects using xAI's Grok API
 * Enhanced with external data verification (website, GitHub, Twitter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket, Project } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { fetchExternalData, formatExternalDataForPrompt, ExternalDataResult } from '@/lib/external-data-fetcher';

const logger = createClientLogger();

// Grok API configuration
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-2-latest';

interface GrokRoastRequest {
  marketId: string;
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
}

/**
 * Generate a roast prompt for Grok with external verification data
 */
function generateRoastPrompt(project: ProjectData, externalData?: ExternalDataResult): string {
  const socialLinksText = project.socialLinks
    ? Object.entries(project.socialLinks)
        .filter(([_, url]) => url)
        .map(([platform, url]) => `${platform}: ${url}`)
        .join('\n')
    : 'None provided';

  const externalVerification = externalData
    ? formatExternalDataForPrompt(externalData)
    : 'External verification not performed';

  return `You are a witty, sarcastic crypto analyst known for your brutally honest but entertaining roasts of crypto projects. Your job is to analyze this project and give a humorous but insightful roast that helps investors make informed decisions.

IMPORTANT: We have automatically verified the project's external links. Use this verification data in your analysis - if a website doesn't exist, GitHub has no commits, or social links are fake, call it out harshly!

PROJECT DETAILS:
- Name: ${project.name}
- Token Symbol: $${project.tokenSymbol}
- Category: ${project.category}
- Type: ${project.projectType}
- Stage: ${project.projectStage}
- Team Size: ${project.teamSize}
- Description: ${project.description}
- Social Links:
${socialLinksText}

=== EXTERNAL VERIFICATION RESULTS ===
${externalVerification}
=== END VERIFICATION ===

YOUR TASK:
1. Give a witty, entertaining roast of this project (2-3 sentences max)
2. Identify 2-3 potential red flags or concerns - USE THE VERIFICATION DATA! If their website is down, GitHub is empty, or socials are fake, these are MAJOR red flags
3. Identify 1-2 potential positives (if any exist - verified working links, active GitHub, etc.)
4. Give a "Legit Score" from 1-10 (1 = obvious scam, 10 = actually promising)

SCORING GUIDELINES:
- Website doesn't exist or is a template: -2 points
- GitHub repo doesn't exist or has <10 commits: -2 points
- GitHub repo is a fork with no original work: -3 points
- No activity on GitHub in 90+ days: -1 point
- Social links are fake/non-existent: -2 points
- All links verified and active: +2 points
- Active GitHub with multiple contributors: +2 points

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

**THE ROAST:**
[Your witty roast here - reference the verification findings!]

**RED FLAGS:**
- [Flag 1 - be specific about verification failures]
- [Flag 2]
- [Flag 3 if applicable]

**POTENTIAL UPSIDE:**
- [Positive 1 - mention verified strengths]
- [Positive 2 if applicable]

**LEGIT SCORE: X/10**
[One sentence explanation referencing the verification data]

Be entertaining but genuinely helpful. If the verification data shows problems, be BRUTAL about it. Scammers hate being exposed!`;
}

/**
 * Call Grok API to generate roast
 */
async function callGrokAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;

  if (!apiKey) {
    throw new Error('GROK_API_KEY environment variable is not set');
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
          content: 'You are a witty crypto analyst who roasts projects with humor while providing genuine insights.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Grok API error', { status: response.status, error: errorText });
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'No roast generated';
}

/**
 * POST /api/grok/roast
 * Generate a roast for a market's project
 */
export async function POST(request: NextRequest) {
  try {
    const body: GrokRoastRequest = await request.json();
    const { marketId } = body;

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

    // Check if roast already exists
    if (market.grokRoast?.content) {
      return NextResponse.json({
        success: true,
        data: {
          roast: market.grokRoast.content,
          generatedAt: market.grokRoast.generatedAt,
          model: market.grokRoast.model,
          cached: true,
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

    // Fetch external data for verification (website, GitHub, Twitter)
    logger.info('Fetching external data for verification', { marketId, projectName: project.name });
    let externalData: ExternalDataResult | undefined;
    try {
      externalData = await fetchExternalData(socialLinksObj);
      logger.info('External data fetched', {
        marketId,
        hasWebsite: !!externalData.website,
        hasGithub: !!externalData.github,
        hasTwitter: !!externalData.twitter,
        errors: externalData.errors,
      });
    } catch (error) {
      logger.warn('Failed to fetch external data, proceeding without verification', {
        marketId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Generate the roast with external verification data
    const prompt = generateRoastPrompt({
      name: project.name,
      description: project.description,
      category: project.category,
      projectType: project.projectType,
      projectStage: project.projectStage,
      teamSize: project.teamSize,
      tokenSymbol: project.tokenSymbol,
      socialLinks: socialLinksObj,
    }, externalData);

    logger.info('Generating Grok roast with verification data', { marketId, projectName: project.name });

    const roastContent = await callGrokAPI(prompt);

    // Save roast to database
    await PredictionMarket.updateOne(
      { _id: marketId },
      {
        $set: {
          grokRoast: {
            content: roastContent,
            generatedAt: new Date(),
            model: GROK_MODEL,
          },
        },
      }
    );

    logger.info('Grok roast generated and saved', { marketId });

    return NextResponse.json({
      success: true,
      data: {
        roast: roastContent,
        generatedAt: new Date(),
        model: GROK_MODEL,
        cached: false,
      },
    });
  } catch (error) {
    logger.error('Failed to generate Grok roast', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate roast',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/grok/roast?marketId=xxx
 * Get existing roast for a market
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

    // Get market with roast
    const market = await PredictionMarket.findById(marketId)
      .select('grokRoast')
      .lean();

    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    if (!market.grokRoast?.content) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No roast generated yet',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        roast: market.grokRoast.content,
        generatedAt: market.grokRoast.generatedAt,
        model: market.grokRoast.model,
      },
    });
  } catch (error) {
    logger.error('Failed to get Grok roast', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get roast',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
