/**
 * API endpoint for completing market creation after client-side signing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';
import { connectToDatabase, Project, PredictionMarket } from '@/lib/mongodb';
import { fetchExternalData, formatExternalDataForPrompt } from '@/lib/external-data-fetcher';

const logger = createClientLogger();

// Grok API configuration
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-3';

/**
 * Generate a Grok roast for a new market with external verification (async, non-blocking)
 */
async function generateGrokRoast(marketId: string, project: any): Promise<void> {
  const apiKey = process.env.GROK_API_KEY;

  if (!apiKey) {
    logger.warn('GROK_API_KEY not configured, skipping roast generation');
    return;
  }

  try {
    // Build social links object
    const socialLinksObj: Record<string, string> = {};
    if (project.socialLinks) {
      if (project.socialLinks instanceof Map) {
        project.socialLinks.forEach((value: string, key: string) => {
          if (value) socialLinksObj[key] = value;
        });
      } else if (typeof project.socialLinks === 'object') {
        Object.entries(project.socialLinks).forEach(([key, value]) => {
          if (value) socialLinksObj[key] = value as string;
        });
      }
    }

    const socialLinksText = Object.keys(socialLinksObj).length > 0
      ? Object.entries(socialLinksObj).map(([k, v]) => `${k}: ${v}`).join('\n')
      : 'None provided';

    // Fetch external data for verification
    logger.info('Fetching external data for new market verification', { marketId, projectName: project.name });
    let externalVerification = 'External verification not performed';
    try {
      const externalData = await fetchExternalData(socialLinksObj);
      externalVerification = formatExternalDataForPrompt(externalData);
      logger.info('External data fetched for new market', {
        marketId,
        hasWebsite: !!externalData.website,
        hasGithub: !!externalData.github,
        hasTwitter: !!externalData.twitter,
      });
    } catch (error) {
      logger.warn('Failed to fetch external data for new market', {
        marketId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const prompt = `You are a witty, sarcastic crypto analyst known for your brutally honest but entertaining roasts of crypto projects. Your job is to analyze this project and give a humorous but insightful roast that helps investors make informed decisions.

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

    logger.info('Generating Grok roast with verification for new market', { marketId, projectName: project.name });

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
            content: 'You are a witty crypto analyst who roasts projects with humor while providing genuine insights. You have access to external verification data and should use it to expose fake or suspicious projects.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Grok API error during market creation', { status: response.status, error: errorText });
      return;
    }

    const data = await response.json();
    const roastContent = data.choices[0]?.message?.content || 'No roast generated';

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

    logger.info('Grok roast with verification generated and saved for new market', { marketId });
  } catch (error) {
    logger.error('Failed to generate Grok roast for new market', {
      marketId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.info('🚀 API: Completing market creation after client-side signing');
    
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['projectId', 'marketAddress', 'transactionSignature'];
    for (const field of requiredFields) {
      if (!body[field]) {
        logger.error(`Missing required field: ${field}`);
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const { projectId, marketAddress, transactionSignature, metadataUri, marketDuration } = body;

    // Connect to MongoDB database
    logger.info('📊 API: Connecting to MongoDB database');
    await connectToDatabase();
    logger.info('📊 API: MongoDB connection successful');

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      logger.error(`Project not found: ${projectId}`);
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Create prediction market document
    const expiryTime = new Date(Date.now() + ((marketDuration || 30) * 24 * 60 * 60 * 1000));
    const finalizationDeadline = new Date(Date.now() + (((marketDuration || 30) + 1) * 24 * 60 * 60 * 1000));
    
    const marketDoc = new PredictionMarket({
      projectId: project._id,
      marketAddress,
      actionsPlatformId: 'plp-platform', // Using custom PLP platform
      marketName: `${project.name} Token Launch Prediction`,
      marketDescription: `Will ${project.name} (${project.tokenSymbol}) successfully launch a token on pump.fun? This prediction market will resolve to YES if the token is successfully created and launched within the specified timeframe.`,
      metadataUri,
      expiryTime,
      finalizationDeadline,
      marketState: 0, // Active
      autoLaunch: true,
      launchWindowEnd: finalizationDeadline,
      createdAt: new Date(),
    });
    
    // Save market to MongoDB
    const savedMarket = await marketDoc.save();
    logger.info('Prediction market saved to MongoDB', {
      marketId: savedMarket._id,
      marketAddress: savedMarket.marketAddress,
      expiryTime: savedMarket.expiryTime
    });

    // Trigger Grok roast generation asynchronously (fire and forget)
    // This runs in the background and doesn't block the response
    generateGrokRoast(savedMarket._id.toString(), project).catch(err => {
      logger.warn('Failed to generate Grok roast (non-blocking)', {
        marketId: savedMarket._id.toString(),
        error: err instanceof Error ? err.message : String(err)
      });
    });

    logger.info('Market creation completed successfully', {
      projectId: project._id,
      marketId: savedMarket._id,
      marketAddress,
      transactionSignature
    });

    return NextResponse.json({
      success: true,
      data: {
        projectId: project._id,
        marketId: savedMarket._id,
        marketAddress,
        transactionSignature,
        projectData: {
          id: project._id,
          name: project.name,
          tokenSymbol: project.tokenSymbol,
          category: project.category,
          status: project.status,
          createdAt: project.createdAt
        },
        marketData: {
          id: savedMarket._id,
          marketAddress: savedMarket.marketAddress,
          expiryTime: savedMarket.expiryTime,
          marketState: savedMarket.marketState
        }
      }
    });

  } catch (error) {
    logger.error('❌ API: Failed to complete market creation:', error);
    logger.error('❌ API: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to complete market creation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
