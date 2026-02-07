import type { GatingConfig } from './types.js';
import { validateSourceUrl } from './sources.js';

/**
 * Discovered candidate with raw evidence links
 */
export interface DiscoveredCandidate {
  name: string;
  handle?: string;
  primaryUrl: string;
  evidenceUrls: string[];
  discoveryMethod: 'github' | 'blog' | 'conference' | 'other';
  languages?: string[];
  focus?: string;
}

/**
 * Discovery result with validation metadata
 */
export interface DiscoveryResult {
  candidates: DiscoveredCandidate[];
  totalFound: number;
  approvedCount: number;
  rejectedCount: number;
  rejectedUrls: string[];
}

/**
 * Discover candidates from GitHub repositories
 * Searches for repos matching target languages from gating config
 */
export function discoverFromGitHub(
  config: GatingConfig,
  searchResults: string[]
): DiscoveredCandidate[] {
  const candidates: DiscoveredCandidate[] = [];

  for (const url of searchResults) {
    // Validate against source registry
    const validation = validateSourceUrl(url);

    if (validation.tier === 'rejected') {
      continue; // Skip disallowed sources
    }

    // Extract owner from GitHub URL (simplified for now)
    // Real implementation would parse GitHub API responses
    const match = url.match(/^https?:\/\/(www\.)?github\.com\/([^/]+)/);
    if (!match) continue;

    const handle = match[2];

    candidates.push({
      name: handle, // In real implementation, fetch from GitHub API
      handle,
      primaryUrl: url,
      evidenceUrls: [url],
      discoveryMethod: 'github',
      languages: config.languages,
      focus: config.engineeringFocus,
    });
  }

  return candidates;
}

/**
 * Discover candidates from technical blogs
 * Searches for blogs matching depth focus from gating config
 */
export function discoverFromBlogs(
  config: GatingConfig,
  searchResults: string[]
): DiscoveredCandidate[] {
  const candidates: DiscoveredCandidate[] = [];

  for (const url of searchResults) {
    const validation = validateSourceUrl(url);

    if (validation.tier === 'rejected') {
      continue;
    }

    // Extract author from blog URL (simplified)
    // Real implementation would parse blog metadata
    candidates.push({
      name: `Blog author`, // Would extract from page metadata
      primaryUrl: url,
      evidenceUrls: [url],
      discoveryMethod: 'blog',
      focus: config.engineeringFocus,
    });
  }

  return candidates;
}

/**
 * Discover candidates from conference talks
 * Searches for conference talk listings matching gating criteria
 */
export function discoverFromConferences(
  config: GatingConfig,
  searchResults: string[]
): DiscoveredCandidate[] {
  const candidates: DiscoveredCandidate[] = [];

  for (const url of searchResults) {
    const validation = validateSourceUrl(url);

    if (validation.tier === 'rejected') {
      continue;
    }

    candidates.push({
      name: `Speaker`, // Would extract from conference page
      primaryUrl: url,
      evidenceUrls: [url],
      discoveryMethod: 'conference',
      focus: config.engineeringFocus,
    });
  }

  return candidates;
}

/**
 * Build search queries from gating config
 * Derives all search parameters from config values
 */
export function buildSearchQueries(config: GatingConfig): {
  github: string[];
  blogs: string[];
  conferences: string[];
} {
  const queries = {
    github: [] as string[],
    blogs: [] as string[],
    conferences: [] as string[],
  };

  // GitHub queries combine languages and focus
  for (const lang of config.languages) {
    queries.github.push(`${lang} ${config.engineeringFocus} site:github.com`);
  }

  // Blog queries combine depth focus with common blog platforms
  queries.blogs.push(`${config.engineeringFocus} ${config.depthExpectation} site:medium.com OR site:dev.to`);

  // Conference talk queries
  if (config.evidencePriorities.includes('Conference talks')) {
    queries.conferences.push(`${config.engineeringFocus} conference talk site:youtube.com`);
    queries.conferences.push(`${config.engineeringFocus} tech conference speakers`);
  }

  return queries;
}

/**
 * Main discovery orchestrator
 * Runs all discovery methods and aggregates results
 */
export function discoverCandidates(
  config: GatingConfig,
  githubResults: string[],
  blogResults: string[],
  conferenceResults: string[]
): DiscoveryResult {
  const allCandidates: DiscoveredCandidate[] = [];

  // Discover from each source type
  allCandidates.push(...discoverFromGitHub(config, githubResults));
  allCandidates.push(...discoverFromBlogs(config, blogResults));
  allCandidates.push(...discoverFromConferences(config, conferenceResults));

  // Collect all URLs for validation
  const allUrls = allCandidates.flatMap((c) => c.evidenceUrls);

  // Filter through source registry
  const approved: string[] = [];
  const rejected: string[] = [];

  for (const url of allUrls) {
    const validation = validateSourceUrl(url);
    if (validation.tier === 'primary' || validation.tier === 'secondary') {
      approved.push(url);
    } else {
      rejected.push(url);
    }
  }

  // Keep only candidates with approved evidence URLs
  const approvedCandidates = allCandidates.filter((candidate) =>
    candidate.evidenceUrls.some((url) => approved.includes(url))
  );

  return {
    candidates: approvedCandidates,
    totalFound: allCandidates.length,
    approvedCount: approvedCandidates.length,
    rejectedCount: rejected.length,
    rejectedUrls: rejected,
  };
}

/**
 * Validate that all candidates have required evidence
 * Each candidate must have at least one source URL
 */
export function validateCandidateEvidence(
  candidate: DiscoveredCandidate
): boolean {
  return (
    candidate.evidenceUrls.length > 0 &&
    candidate.primaryUrl.length > 0 &&
    candidate.evidenceUrls.includes(candidate.primaryUrl)
  );
}
