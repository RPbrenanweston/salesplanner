/**
 * @crumb
 * @id validation-five-signals
 * @area DAT
 * @intent Evaluate 5 signals (code, depth, sustained, thinking, peer) against discovered candidates; only include profiles with ≥3 signals
 * @responsibilities Signal evaluation (5 functions), threshold gating, citation mapping, profile conversion
 * @contracts evaluateCodeSignal(candidate) → SignalResult; evaluateDepthSignal(candidate, config) → SignalResult; evaluateSustainedSignal(candidate) → SignalResult; evaluateThinkingSignal(candidate) → SignalResult; evaluatePeerSignal(candidate) → SignalResult; validateCandidate(candidate, config) → ValidationResult; toValidatedProfile(validation) → ValidatedProfile
 * @in DiscoveredCandidate[], GatingConfig
 * @out ValidatedProfile[] (only candidates with signalCount ≥ 3)
 * @err ValidationError if validation.included === false on toValidatedProfile()
 * @hazard Signal evaluation functions check URL patterns only — no HTTP validation (404s not detected until enforcement phase)
 * @hazard evaluateDepthSignal checks candidate.name for keywords instead of fetching/analyzing content (false positives on name overlaps with tech terms)
 * @shared-edges discovery.ts→PROVIDES input; database.ts→CONSUMES output; enforcement.ts→CONSUMES ValidatedProfile[]
 * @trail validation-pipeline#2 | 5 signals evaluated in sequence before threshold gating
 * @prompt Before adding new signals, audit false positive rate against test set. Consider URL verification cost vs benefit (move to enforcement?).
 */

import { DiscoveredCandidate } from './discovery.js';
import { GatingConfig, SignalName, Citation, ValidatedProfile } from './types.js';

/**
 * Signal evaluation result: present or absent.
 * If present, must include at least one citation.
 */
export interface SignalResult {
  signal: SignalName;
  present: boolean;
  citations: Citation[];
}

/**
 * Complete validation result for a candidate.
 */
export interface ValidationResult {
  candidate: DiscoveredCandidate;
  signals: SignalResult[];
  signalCount: number;
  included: boolean;
  reason?: string;
}

/**
 * Evaluate Code Signal: non-trivial repos, meaningful PRs.
 *
 * Evidence:
 * - GitHub repositories with meaningful commits
 * - Merged pull requests with substantive changes
 * - Code contributions beyond trivial fixes
 *
 * NOT evidence:
 * - Job titles mentioning "engineer"
 * - Resume claims
 * - Fork counts without inspection
 */
export function evaluateCodeSignal(candidate: DiscoveredCandidate): SignalResult {
  const citations: Citation[] = [];

  // Check evidence URLs for GitHub repositories and commits
  for (const url of candidate.evidenceUrls) {
    const githubRepoMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
    const githubCommitMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\//);
    const githubPRMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\//);

    if (githubRepoMatch) {
      citations.push({
        signal: 'code',
        url,
        description: `GitHub repository: ${githubRepoMatch[1]}/${githubRepoMatch[2]}`,
      });
    } else if (githubCommitMatch) {
      citations.push({
        signal: 'code',
        url,
        description: `Code contribution in ${githubCommitMatch[1]}/${githubCommitMatch[2]}`,
      });
    } else if (githubPRMatch) {
      citations.push({
        signal: 'code',
        url,
        description: `Pull request in ${githubPRMatch[1]}/${githubPRMatch[2]}`,
      });
    }
  }

  return {
    signal: 'code',
    present: citations.length > 0,
    citations,
  };
}

/**
 * Evaluate Depth Signal: systems/infra/performance/scaling concerns.
 *
 * Evidence:
 * - Blog posts about distributed systems, performance, infrastructure
 * - Conference talks on scalability, architecture, deep technical topics
 * - RFCs or design documents
 * - GitHub discussions on systems-level concerns
 *
 * NOT evidence:
 * - Shallow tutorial content
 * - Basic how-to guides
 * - Job titles with "senior" or "principal"
 */
export function evaluateDepthSignal(
  candidate: DiscoveredCandidate,
  config: GatingConfig
): SignalResult {
  const citations: Citation[] = [];
  const depthKeywords = [
    'distributed',
    'systems',
    'performance',
    'scaling',
    'infrastructure',
    'architecture',
    'optimization',
    'reliability',
    'concurrency',
    'database',
    'caching',
    'networking',
  ];

  // Check for conference talks (high-quality depth indicator)
  for (const url of candidate.evidenceUrls) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      citations.push({
        signal: 'depth',
        url,
        description: 'Conference talk or technical presentation',
      });
    }
  }

  // Check for blog posts with depth keywords in title/description
  // (In real implementation, would fetch and analyze content)
  for (const url of candidate.evidenceUrls) {
    const isBlog = url.includes('medium.com') ||
                   url.includes('dev.to') ||
                   url.includes('blog') ||
                   (!url.includes('github.com') && !url.includes('stackoverflow.com'));

    if (isBlog && depthKeywords.some(kw => candidate.name.toLowerCase().includes(kw))) {
      citations.push({
        signal: 'depth',
        url,
        description: `Technical writing matching depth focus: ${config.depthExpectation}`,
      });
    }
  }

  return {
    signal: 'depth',
    present: citations.length > 0,
    citations,
  };
}

/**
 * Evaluate Sustained Signal: evidence across 12+ months.
 *
 * Evidence:
 * - GitHub contribution graph showing consistent activity
 * - Blog posts published over multiple years
 * - Conference talks in different years
 * - Ongoing project maintenance
 *
 * NOT evidence:
 * - Job titles with years of experience
 * - Resume claims
 * - Single burst of activity
 */
export function evaluateSustainedSignal(candidate: DiscoveredCandidate): SignalResult {
  const citations: Citation[] = [];

  // Check for GitHub profile (contribution history)
  for (const url of candidate.evidenceUrls) {
    const githubProfileMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/?$/);
    if (githubProfileMatch) {
      citations.push({
        signal: 'sustained',
        url,
        description: `GitHub activity history for ${githubProfileMatch[1]}`,
      });
    }
  }

  // Check for multiple evidence URLs from different time periods
  // (In real implementation, would extract dates from URLs/content)
  if (candidate.evidenceUrls.length >= 3) {
    citations.push({
      signal: 'sustained',
      url: candidate.primaryUrl,
      description: 'Multiple artefacts suggesting sustained activity',
    });
  }

  return {
    signal: 'sustained',
    present: citations.length > 0,
    citations,
  };
}

/**
 * Evaluate Thinking Signal: blogs, RFCs, long-form explanations.
 *
 * Evidence:
 * - Technical blog posts
 * - RFC documents
 * - Design documents
 * - Conference talk abstracts/slides
 * - Long-form Stack Overflow answers
 *
 * NOT evidence:
 * - Code comments
 * - Job descriptions
 * - Short tweets
 */
export function evaluateThinkingSignal(candidate: DiscoveredCandidate): SignalResult {
  const citations: Citation[] = [];

  // Check for blog URLs
  for (const url of candidate.evidenceUrls) {
    const isBlog = url.includes('medium.com') ||
                   url.includes('dev.to') ||
                   url.includes('substack.com') ||
                   url.includes('blog') ||
                   url.includes('writing');

    if (isBlog) {
      citations.push({
        signal: 'thinking',
        url,
        description: 'Technical writing or long-form explanation',
      });
    }
  }

  // Check for conference talks (thinking + presentation)
  for (const url of candidate.evidenceUrls) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      citations.push({
        signal: 'thinking',
        url,
        description: 'Conference presentation demonstrating technical communication',
      });
    }
  }

  return {
    signal: 'thinking',
    present: citations.length > 0,
    citations,
  };
}

/**
 * Evaluate Peer Signal: accepted PRs, referenced work, high-signal SO answers.
 *
 * Evidence:
 * - Merged pull requests in external projects
 * - Stack Overflow answers with upvotes
 * - GitHub discussions with engagement
 * - Citations in other engineers' work
 *
 * NOT evidence:
 * - Star counts without inspection
 * - LinkedIn endorsements
 * - Job titles
 */
export function evaluatePeerSignal(candidate: DiscoveredCandidate): SignalResult {
  const citations: Citation[] = [];

  // Check for merged PRs
  for (const url of candidate.evidenceUrls) {
    const githubPRMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\//);
    if (githubPRMatch) {
      citations.push({
        signal: 'peer',
        url,
        description: `Merged pull request in ${githubPRMatch[1]}/${githubPRMatch[2]}`,
      });
    }
  }

  // Check for Stack Overflow profile
  for (const url of candidate.evidenceUrls) {
    if (url.includes('stackoverflow.com/users/')) {
      citations.push({
        signal: 'peer',
        url,
        description: 'Stack Overflow contributions with peer validation',
      });
    }
  }

  // Check for GitHub discussions
  for (const url of candidate.evidenceUrls) {
    if (url.includes('github.com') && url.includes('discussions')) {
      citations.push({
        signal: 'peer',
        url,
        description: 'GitHub discussion participation',
      });
    }
  }

  return {
    signal: 'peer',
    present: citations.length > 0,
    citations,
  };
}

/**
 * Validate a discovered candidate against all five signals.
 *
 * Returns validation result with signal count and inclusion decision.
 * Profile included only when ≥3 signals present.
 */
export function validateCandidate(
  candidate: DiscoveredCandidate,
  config: GatingConfig
): ValidationResult {
  const signals: SignalResult[] = [
    evaluateCodeSignal(candidate),
    evaluateDepthSignal(candidate, config),
    evaluateSustainedSignal(candidate),
    evaluateThinkingSignal(candidate),
    evaluatePeerSignal(candidate),
  ];

  const signalCount = signals.filter(s => s.present).length;
  const included = signalCount >= 3;

  return {
    candidate,
    signals,
    signalCount,
    included,
    reason: included
      ? `${signalCount} signals present (minimum: 3)`
      : `Only ${signalCount} signals present (minimum: 3 required)`,
  };
}

/**
 * Convert a validation result to a validated profile.
 * Only call this for candidates where validation.included === true.
 */
export function toValidatedProfile(validation: ValidationResult): ValidatedProfile {
  if (!validation.included) {
    throw new Error('Cannot convert excluded candidate to validated profile');
  }

  const signalMap: Record<SignalName, boolean> = {
    code: false,
    depth: false,
    sustained: false,
    thinking: false,
    peer: false,
  };

  const allCitations: Citation[] = [];

  for (const signal of validation.signals) {
    signalMap[signal.signal] = signal.present;
    allCitations.push(...signal.citations);
  }

  return {
    name: validation.candidate.name,
    handle: validation.candidate.handle,
    primaryUrl: validation.candidate.primaryUrl,
    languages: validation.candidate.languages || [],
    engineeringFocus: validation.candidate.focus || 'Unknown',
    geography: undefined,
    signals: signalMap,
    citations: allCitations,
  };
}

/**
 * Validate a batch of discovered candidates.
 * Returns array of validation results.
 */
export function validateCandidates(
  candidates: DiscoveredCandidate[],
  config: GatingConfig
): ValidationResult[] {
  return candidates.map(candidate => validateCandidate(candidate, config));
}

/**
 * Filter validation results to only included profiles.
 */
export function filterIncludedProfiles(
  validations: ValidationResult[]
): ValidatedProfile[] {
  return validations
    .filter(v => v.included)
    .map(v => toValidatedProfile(v));
}
