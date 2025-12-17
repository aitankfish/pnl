/**
 * External Data Fetcher
 * Fetches and analyzes external data from websites, GitHub, and social links
 * Used by Grok roast to verify project claims
 */

import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

// Timeout for external fetches (5 seconds)
const FETCH_TIMEOUT = 5000;

export interface ExternalDataResult {
  website?: WebsiteData | null;
  github?: GitHubData | null;
  twitter?: TwitterData | null;
  errors: string[];
}

export interface WebsiteData {
  exists: boolean;
  title?: string;
  description?: string;
  contentPreview?: string;
  hasSSL: boolean;
  domain: string;
  error?: string;
}

export interface GitHubData {
  exists: boolean;
  repoName?: string;
  owner?: string;
  description?: string;
  stars?: number;
  forks?: number;
  openIssues?: number;
  createdAt?: string;
  updatedAt?: string;
  pushedAt?: string;
  language?: string;
  hasReadme?: boolean;
  commitCount?: number;
  contributorCount?: number;
  isArchived?: boolean;
  isFork?: boolean;
  daysSinceLastPush?: number;
  error?: string;
}

export interface TwitterData {
  exists: boolean;
  username?: string;
  error?: string;
}

/**
 * Fetch all external data for a project
 */
export async function fetchExternalData(socialLinks: Record<string, string>): Promise<ExternalDataResult> {
  const result: ExternalDataResult = {
    errors: [],
  };

  const promises: Promise<void>[] = [];

  // Fetch website data
  const websiteUrl = socialLinks.website || socialLinks.Website;
  if (websiteUrl) {
    promises.push(
      fetchWebsiteData(websiteUrl)
        .then(data => { result.website = data; })
        .catch(err => {
          result.errors.push(`Website fetch failed: ${err.message}`);
          result.website = { exists: false, hasSSL: false, domain: '', error: err.message };
        })
    );
  }

  // Fetch GitHub data
  const githubUrl = socialLinks.github || socialLinks.Github || socialLinks.GitHub;
  if (githubUrl) {
    promises.push(
      fetchGitHubData(githubUrl)
        .then(data => { result.github = data; })
        .catch(err => {
          result.errors.push(`GitHub fetch failed: ${err.message}`);
          result.github = { exists: false, error: err.message };
        })
    );
  }

  // Check Twitter existence
  const twitterUrl = socialLinks.twitter || socialLinks.Twitter || socialLinks.x || socialLinks.X;
  if (twitterUrl) {
    promises.push(
      checkTwitterExists(twitterUrl)
        .then(data => { result.twitter = data; })
        .catch(err => {
          result.errors.push(`Twitter check failed: ${err.message}`);
          result.twitter = { exists: false, error: err.message };
        })
    );
  }

  // Wait for all fetches (with individual error handling)
  await Promise.all(promises);

  return result;
}

/**
 * Fetch and analyze website content
 */
async function fetchWebsiteData(url: string): Promise<WebsiteData> {
  try {
    // Ensure URL has protocol
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = `https://${url}`;
    }

    const parsedUrl = new URL(fullUrl);
    const hasSSL = parsedUrl.protocol === 'https:';

    const response = await fetch(fullUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PLPBot/1.0; +https://pnl.market)',
      },
    });

    if (!response.ok) {
      return {
        exists: false,
        hasSSL,
        domain: parsedUrl.hostname,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    // Extract text content preview (strip HTML tags)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let contentPreview = '';
    if (bodyMatch) {
      contentPreview = bodyMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1000);
    }

    // Check for template indicators
    const isTemplate = html.includes('starter template') ||
                      html.includes('lorem ipsum') ||
                      html.includes('coming soon') ||
                      html.includes('under construction') ||
                      contentPreview.length < 100;

    return {
      exists: true,
      title,
      description,
      contentPreview: contentPreview + (isTemplate ? ' [POSSIBLE TEMPLATE/PLACEHOLDER SITE]' : ''),
      hasSSL,
      domain: parsedUrl.hostname,
    };
  } catch (error) {
    logger.warn('Website fetch error', { url, error: error instanceof Error ? error.message : String(error) });
    return {
      exists: false,
      hasSSL: url.startsWith('https'),
      domain: url,
      error: error instanceof Error ? error.message : 'Failed to fetch',
    };
  }
}

/**
 * Fetch GitHub repository data using GitHub API
 */
async function fetchGitHubData(url: string): Promise<GitHubData> {
  try {
    // Extract owner/repo from various GitHub URL formats
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\?#]+)/i,
      /github\.com\/([^\/]+)\/?$/i,
    ];

    let owner = '';
    let repo = '';

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        owner = match[1];
        repo = match[2]?.replace(/\.git$/, '') || '';
        break;
      }
    }

    if (!owner) {
      return { exists: false, error: 'Invalid GitHub URL' };
    }

    // If no repo specified, it's just a profile - still useful info
    if (!repo) {
      // Try to get user/org info
      const userResponse = await fetch(`https://api.github.com/users/${owner}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PLP-Platform',
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        return {
          exists: true,
          owner,
          description: `GitHub profile: ${userData.public_repos || 0} public repos, ${userData.followers || 0} followers`,
          createdAt: userData.created_at,
        };
      }
      return { exists: false, error: 'GitHub user not found' };
    }

    // Fetch repository data
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PLP-Platform',
      },
    });

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        return { exists: false, error: 'Repository not found' };
      }
      return { exists: false, error: `GitHub API error: ${repoResponse.status}` };
    }

    const repoData = await repoResponse.json();

    // Calculate days since last push
    const lastPush = new Date(repoData.pushed_at);
    const daysSinceLastPush = Math.floor((Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24));

    // Try to get commit count (requires additional API call)
    let commitCount = 0;
    try {
      const commitsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
        {
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'PLP-Platform',
          },
        }
      );
      if (commitsResponse.ok) {
        // GitHub returns total count in Link header
        const linkHeader = commitsResponse.headers.get('Link');
        if (linkHeader) {
          const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (lastMatch) {
            commitCount = parseInt(lastMatch[1], 10);
          }
        } else {
          // Single page of results
          const commits = await commitsResponse.json();
          commitCount = commits.length;
        }
      }
    } catch {
      // Commit count fetch failed, continue without it
    }

    // Try to get contributor count
    let contributorCount = 0;
    try {
      const contribResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1`,
        {
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'PLP-Platform',
          },
        }
      );
      if (contribResponse.ok) {
        const linkHeader = contribResponse.headers.get('Link');
        if (linkHeader) {
          const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (lastMatch) {
            contributorCount = parseInt(lastMatch[1], 10);
          }
        } else {
          const contributors = await contribResponse.json();
          contributorCount = contributors.length;
        }
      }
    } catch {
      // Contributor count fetch failed, continue without it
    }

    return {
      exists: true,
      repoName: repoData.name,
      owner: repoData.owner?.login,
      description: repoData.description,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
      pushedAt: repoData.pushed_at,
      language: repoData.language,
      hasReadme: repoData.has_readme !== false, // Assume true if not explicitly false
      commitCount,
      contributorCount,
      isArchived: repoData.archived,
      isFork: repoData.fork,
      daysSinceLastPush,
    };
  } catch (error) {
    logger.warn('GitHub fetch error', { url, error: error instanceof Error ? error.message : String(error) });
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Failed to fetch',
    };
  }
}

/**
 * Check if Twitter/X account exists
 * Note: Limited without API access - just checks if the URL pattern is valid
 */
async function checkTwitterExists(url: string): Promise<TwitterData> {
  try {
    // Extract username from various Twitter/X URL formats
    const patterns = [
      /(?:twitter\.com|x\.com)\/([^\/\?#]+)/i,
      /@([a-zA-Z0-9_]+)/,
    ];

    let username = '';
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        username = match[1];
        break;
      }
    }

    if (!username || username === 'home' || username === 'explore' || username === 'search') {
      return { exists: false, error: 'Invalid Twitter URL' };
    }

    // Try to fetch the profile page (may be blocked, but worth trying)
    // Note: Twitter heavily restricts scraping, so this is best-effort
    try {
      const response = await fetch(`https://x.com/${username}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PLPBot/1.0)',
        },
        redirect: 'follow',
      });

      // If we get a 404 or redirect to suspended page, account doesn't exist
      if (response.status === 404) {
        return { exists: false, username, error: 'Account not found' };
      }

      // Check if page contains suspension notice
      const html = await response.text();
      if (html.includes('This account doesn') || html.includes('suspended')) {
        return { exists: false, username, error: 'Account suspended' };
      }

      // Assume exists if we got a response
      return { exists: true, username };
    } catch {
      // If fetch fails, we can't verify but username format is valid
      return { exists: true, username, error: 'Could not verify (may exist)' };
    }
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Failed to check',
    };
  }
}

/**
 * Format external data into a string for the Grok prompt
 */
export function formatExternalDataForPrompt(data: ExternalDataResult): string {
  const sections: string[] = [];

  // Website analysis
  if (data.website) {
    if (data.website.exists) {
      sections.push(`WEBSITE VERIFICATION:
- URL works: Yes
- SSL/HTTPS: ${data.website.hasSSL ? 'Yes' : 'NO - Security risk!'}
- Domain: ${data.website.domain}
- Title: ${data.website.title || 'None found'}
- Description: ${data.website.description || 'None found'}
- Content preview: ${data.website.contentPreview?.slice(0, 500) || 'Could not extract'}`);
    } else {
      sections.push(`WEBSITE VERIFICATION:
- URL works: NO - ${data.website.error || 'Site unreachable'}
- This is a RED FLAG - claimed website doesn't exist!`);
    }
  }

  // GitHub analysis
  if (data.github) {
    if (data.github.exists && data.github.repoName) {
      const warnings: string[] = [];
      if (data.github.commitCount !== undefined && data.github.commitCount < 10) {
        warnings.push('Very few commits');
      }
      if (data.github.daysSinceLastPush !== undefined && data.github.daysSinceLastPush > 90) {
        warnings.push(`No updates in ${data.github.daysSinceLastPush} days`);
      }
      if (data.github.contributorCount !== undefined && data.github.contributorCount <= 1) {
        warnings.push('Single contributor only');
      }
      if (data.github.isFork) {
        warnings.push('This is a FORK, not original code');
      }
      if (data.github.isArchived) {
        warnings.push('Repository is ARCHIVED (abandoned)');
      }

      sections.push(`GITHUB VERIFICATION:
- Repository exists: Yes
- Repo: ${data.github.owner}/${data.github.repoName}
- Description: ${data.github.description || 'None'}
- Stars: ${data.github.stars || 0}
- Forks: ${data.github.forks || 0}
- Primary language: ${data.github.language || 'Unknown'}
- Commits: ${data.github.commitCount || 'Unknown'}
- Contributors: ${data.github.contributorCount || 'Unknown'}
- Last push: ${data.github.pushedAt ? new Date(data.github.pushedAt).toLocaleDateString() : 'Unknown'} (${data.github.daysSinceLastPush || '?'} days ago)
- Created: ${data.github.createdAt ? new Date(data.github.createdAt).toLocaleDateString() : 'Unknown'}
- Is fork: ${data.github.isFork ? 'YES' : 'No'}
- Is archived: ${data.github.isArchived ? 'YES' : 'No'}
${warnings.length > 0 ? `- WARNINGS: ${warnings.join(', ')}` : ''}`);
    } else if (data.github.exists) {
      sections.push(`GITHUB VERIFICATION:
- GitHub profile found: ${data.github.owner}
- ${data.github.description || 'No specific repository linked'}`);
    } else {
      sections.push(`GITHUB VERIFICATION:
- Repository exists: NO - ${data.github.error || 'Not found'}
- This is a RED FLAG if they claim to have working code!`);
    }
  }

  // Twitter analysis
  if (data.twitter) {
    if (data.twitter.exists) {
      sections.push(`TWITTER/X VERIFICATION:
- Account exists: Yes
- Username: @${data.twitter.username}
${data.twitter.error ? `- Note: ${data.twitter.error}` : ''}`);
    } else {
      sections.push(`TWITTER/X VERIFICATION:
- Account exists: NO - ${data.twitter.error || 'Not found'}
- Claimed social presence cannot be verified`);
    }
  }

  if (data.errors.length > 0) {
    sections.push(`\nVERIFICATION ERRORS: ${data.errors.join(', ')}`);
  }

  return sections.join('\n\n');
}
