/**
 * Data Source Registry and Validation
 *
 * Defines approved, secondary, and disallowed sources for engineer discovery.
 * Enforces citation quality by preventing reliance on paid databases and inference tools.
 */

export type SourceTier = 'primary' | 'secondary' | 'disallowed';

export interface SourceRegistry {
  primary: SourcePattern[];
  secondary: SourcePattern[];
  disallowed: SourcePattern[];
}

export interface SourcePattern {
  name: string;
  pattern: RegExp;
  description: string;
}

/**
 * Source registry defining approved and disallowed data sources
 */
export const SOURCE_REGISTRY: SourceRegistry = {
  primary: [
    {
      name: 'GitHub Discussions',
      pattern: /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/(discussions|issues|pull)/i,
      description: 'GitHub discussions, issues, and pull requests'
    },
    {
      name: 'GitHub Repositories',
      pattern: /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/i,
      description: 'GitHub repositories and commit history'
    },
    {
      name: 'Medium',
      pattern: /^https?:\/\/(www\.)?(medium\.com|.*\.medium\.com)/i,
      description: 'Medium technical articles'
    },
    {
      name: 'Dev.to',
      pattern: /^https?:\/\/(www\.)?dev\.to/i,
      description: 'Dev.to technical articles'
    },
    {
      name: 'Conference Talks (YouTube)',
      pattern: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i,
      description: 'Conference talks on YouTube'
    },
    {
      name: 'Conference Event Pages',
      pattern: /^https?:\/\/.*\/(conference|event|talk|speaker)/i,
      description: 'Conference and event pages'
    },
    {
      name: 'RFCs and Whitepapers',
      pattern: /^https?:\/\/.*\/(rfc|whitepaper|paper|pdf)/i,
      description: 'Technical RFCs and whitepapers'
    },
    {
      name: 'Personal Blogs',
      pattern: /^https?:\/\/(?!.*(?:linkedin\.com|indeed\.com|glassdoor\.com|stackoverflow\.com|github\.com))/i,
      description: 'Personal and technical blogs (excluding job sites and known platforms)'
    }
  ],
  secondary: [
    {
      name: 'Stack Overflow',
      pattern: /^https?:\/\/(www\.)?stackoverflow\.com\/users/i,
      description: 'Stack Overflow profiles and answers'
    },
    {
      name: 'GitHub Profile',
      pattern: /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/i,
      description: 'GitHub profile summaries (read-only)'
    }
  ],
  disallowed: [
    {
      name: 'LinkedIn',
      pattern: /^https?:\/\/(www\.)?linkedin\.com/i,
      description: 'LinkedIn profiles (scraping prohibited)'
    },
    {
      name: 'Indeed',
      pattern: /^https?:\/\/(www\.)?indeed\.com/i,
      description: 'Resume aggregator'
    },
    {
      name: 'Glassdoor',
      pattern: /^https?:\/\/(www\.)?glassdoor\.com/i,
      description: 'Resume aggregator'
    },
    {
      name: 'Monster',
      pattern: /^https?:\/\/(www\.)?monster\.com/i,
      description: 'Resume aggregator'
    },
    {
      name: 'ZipRecruiter',
      pattern: /^https?:\/\/(www\.)?ziprecruiter\.com/i,
      description: 'Resume aggregator'
    },
    {
      name: 'AngelList Talent',
      pattern: /^https?:\/\/(www\.)?angel\.co\/talent/i,
      description: 'Paid talent database'
    },
    {
      name: 'Hired',
      pattern: /^https?:\/\/(www\.)?hired\.com/i,
      description: 'Paid talent marketplace'
    },
    {
      name: 'Toptal',
      pattern: /^https?:\/\/(www\.)?toptal\.com/i,
      description: 'Paid talent marketplace'
    },
    {
      name: 'Codility',
      pattern: /^https?:\/\/(www\.)?codility\.com/i,
      description: 'Skill inference tool'
    },
    {
      name: 'HackerRank Profiles',
      pattern: /^https?:\/\/(www\.)?hackerrank\.com\/(?!challenges|domains)/i,
      description: 'Skill inference profiles'
    }
  ]
};

/**
 * Validation result for a source URL
 */
export interface SourceValidation {
  url: string;
  tier: SourceTier | 'rejected';
  matchedPattern?: string;
  reason?: string;
}

/**
 * Validates a source URL against the source registry
 *
 * @param url - The URL to validate
 * @returns Validation result with tier and reasoning
 */
export function validateSourceUrl(url: string): SourceValidation {
  // Check disallowed sources first (highest priority)
  for (const source of SOURCE_REGISTRY.disallowed) {
    if (source.pattern.test(url)) {
      return {
        url,
        tier: 'rejected',
        matchedPattern: source.name,
        reason: `Disallowed source: ${source.description}`
      };
    }
  }

  // Check primary sources
  for (const source of SOURCE_REGISTRY.primary) {
    if (source.pattern.test(url)) {
      return {
        url,
        tier: 'primary',
        matchedPattern: source.name
      };
    }
  }

  // Check secondary sources
  for (const source of SOURCE_REGISTRY.secondary) {
    if (source.pattern.test(url)) {
      return {
        url,
        tier: 'secondary',
        matchedPattern: source.name
      };
    }
  }

  // Unknown source - allow but flag for review
  return {
    url,
    tier: 'primary',
    matchedPattern: 'Unknown source',
    reason: 'URL does not match known patterns - verify manually'
  };
}

/**
 * Batch validate multiple URLs
 *
 * @param urls - Array of URLs to validate
 * @returns Array of validation results
 */
export function validateSourceUrls(urls: string[]): SourceValidation[] {
  return urls.map(validateSourceUrl);
}

/**
 * Filter URLs to only approved sources (primary + secondary)
 *
 * @param urls - Array of URLs to filter
 * @returns Array of approved URLs only
 */
export function filterApprovedSources(urls: string[]): string[] {
  return urls.filter(url => {
    const validation = validateSourceUrl(url);
    return validation.tier === 'primary' || validation.tier === 'secondary';
  });
}
