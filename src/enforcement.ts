/**
 * Hallucination Control Enforcement Layer
 *
 * Hard rules that prevent uncited claims, inferred seniority, and unsupported assertions.
 * This is the quality gate between validated profiles and final report generation.
 */

import { ValidatedProfile, Citation } from './types';

/**
 * Violation represents a specific enforcement failure
 */
export interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  offendingStatement: string;
  context?: string;
  profileIdentifier?: string;
}

/**
 * EnforcementResult tracks all violations found during validation
 */
export interface EnforcementResult {
  passed: boolean;
  violations: Violation[];
  profilesProcessed: number;
  profilesRejected: number;
}

/**
 * Statement patterns that indicate uncited factual claims
 */
const FACTUAL_CLAIM_PATTERNS = [
  /\b(created|built|implemented|designed|architected|developed|wrote|authored)\b/i,
  /\b(contributed to|maintained|improved|optimized|refactored)\b/i,
  /\b(works? at|worked at|employed by|position at)\b/i,
  /\b(speaks at|spoke at|presented at|talks? about)\b/i,
  /\b(\d+\+?\s+years?|senior|lead|principal|staff|expert)\b/i,
  /\b(proficient in|skilled in|experienced with|specializes in)\b/i,
];

/**
 * Patterns that indicate seniority inference from time alone
 */
const SENIORITY_INFERENCE_PATTERNS = [
  /(\d+\+?\s+years?).*(senior|lead|principal|expert)/i,
  /(senior|lead|principal|expert).*(with|based on|given|considering).*(\d+\+?\s+years?)/i,
  /long[- ]?time contributor/i,
  /veteran developer/i,
];

/**
 * Patterns that indicate skill summarization without artefacts
 */
const SKILL_SUMMARIZATION_PATTERNS = [
  /proficient in\s+[^.]+(?!\s+\()/i, // "proficient in X" without citation
  /skilled in\s+[^.]+(?!\s+\()/i,
  /experienced with\s+[^.]+(?!\s+\()/i,
  /specializes in\s+[^.]+(?!\s+\()/i,
  /expertise in\s+[^.]+(?!\s+\()/i,
];

/**
 * Check if a statement contains a URL citation
 */
function hasCitation(statement: string): boolean {
  // Look for URLs in parentheses or as markdown links
  const citationPatterns = [
    /\(https?:\/\/[^\s)]+\)/,           // (http://example.com)
    /\[.*?\]\(https?:\/\/[^\s)]+\)/,   // [text](http://example.com)
  ];

  return citationPatterns.some(pattern => pattern.test(statement));
}

/**
 * Extract sentences from text for granular analysis
 */
function extractSentences(text: string): string[] {
  // Split on sentence boundaries, preserving URLs
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Check if a statement appears to be a factual claim
 */
function isFactualClaim(sentence: string): boolean {
  // Skip obvious non-factual statements
  if (sentence.startsWith('Note:') || sentence.startsWith('Limitation:')) {
    return false;
  }

  return FACTUAL_CLAIM_PATTERNS.some(pattern => pattern.test(sentence));
}

/**
 * Rule 1: Every factual claim must have a citation
 */
export function checkCitationCoverage(
  profileText: string,
  _citations: Citation[],
  profileIdentifier: string
): Violation[] {
  const violations: Violation[] = [];
  const sentences = extractSentences(profileText);

  for (const sentence of sentences) {
    if (isFactualClaim(sentence) && !hasCitation(sentence)) {
      violations.push({
        rule: 'citation_required',
        severity: 'error',
        offendingStatement: sentence,
        context: 'Every factual claim must include a URL citation',
        profileIdentifier,
      });
    }
  }

  return violations;
}

/**
 * Rule 2: No seniority inference from years alone
 */
export function checkSeniorityInference(
  profileText: string,
  profileIdentifier: string
): Violation[] {
  const violations: Violation[] = [];
  const sentences = extractSentences(profileText);

  for (const sentence of sentences) {
    if (SENIORITY_INFERENCE_PATTERNS.some(pattern => pattern.test(sentence))) {
      violations.push({
        rule: 'seniority_inference',
        severity: 'error',
        offendingStatement: sentence,
        context: 'Cannot infer seniority from years of experience alone',
        profileIdentifier,
      });
    }
  }

  return violations;
}

/**
 * Rule 3: No skill summarization without artefact links
 */
export function checkSkillSummarization(
  profileText: string,
  profileIdentifier: string
): Violation[] {
  const violations: Violation[] = [];
  const sentences = extractSentences(profileText);

  for (const sentence of sentences) {
    if (SKILL_SUMMARIZATION_PATTERNS.some(pattern => pattern.test(sentence))) {
      if (!hasCitation(sentence)) {
        violations.push({
          rule: 'skill_without_artefact',
          severity: 'error',
          offendingStatement: sentence,
          context: 'Skill claims require linked artefacts',
          profileIdentifier,
        });
      }
    }
  }

  return violations;
}

/**
 * Rule 4: Contradictory sources cause profile exclusion
 */
export function checkContradictions(
  citations: Citation[],
  profileIdentifier: string
): Violation[] {
  const violations: Violation[] = [];

  // Group citations by signal type
  const citationsBySignal = citations.reduce((acc, citation) => {
    if (!acc[citation.signal]) {
      acc[citation.signal] = [];
    }
    acc[citation.signal].push(citation);
    return acc;
  }, {} as Record<string, Citation[]>);

  // Check for contradictions within each signal
  for (const [signal, signalCitations] of Object.entries(citationsBySignal)) {
    // Type guard - we know these are Citation arrays from our reduce
    if (!Array.isArray(signalCitations)) continue;

    // Look for contradictory descriptions
    const descriptions = (signalCitations as Citation[]).map(c => c.description.toLowerCase());

    // Check for obvious contradictions (e.g., "uses X" vs "doesn't use X")
    const typedCitations = signalCitations as Citation[];
    for (let i = 0; i < descriptions.length; i++) {
      for (let j = i + 1; j < descriptions.length; j++) {
        if (areContradictory(descriptions[i], descriptions[j])) {
          violations.push({
            rule: 'contradictory_sources',
            severity: 'error',
            offendingStatement: `${typedCitations[i].description} vs ${typedCitations[j].description}`,
            context: `Contradictory evidence in ${signal} signal`,
            profileIdentifier,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Detect if two descriptions contradict each other
 */
function areContradictory(desc1: string, desc2: string): boolean {
  // Simple contradiction detection - can be enhanced
  const contradictionPairs = [
    ['uses', 'does not use'],
    ['supports', 'does not support'],
    ['includes', 'excludes'],
    ['allows', 'prevents'],
  ];

  for (const [positive, negative] of contradictionPairs) {
    if ((desc1.includes(positive) && desc2.includes(negative)) ||
        (desc1.includes(negative) && desc2.includes(positive))) {
      return true;
    }
  }

  return false;
}

/**
 * Main enforcement function - runs all validation rules
 */
export function enforceHallucinationControl(
  profiles: ValidatedProfile[],
  getProfileText: (profile: ValidatedProfile) => string
): EnforcementResult {
  const allViolations: Violation[] = [];
  const rejectedProfiles = new Set<string>();

  for (const profile of profiles) {
    const identifier = profile.name || profile.handle || 'unknown';
    const profileText = getProfileText(profile);

    // Run all enforcement checks
    const violations = [
      ...checkCitationCoverage(profileText, profile.citations, identifier),
      ...checkSeniorityInference(profileText, identifier),
      ...checkSkillSummarization(profileText, identifier),
      ...checkContradictions(profile.citations, identifier),
    ];

    allViolations.push(...violations);

    // Any error-level violation causes profile rejection
    if (violations.some(v => v.severity === 'error')) {
      rejectedProfiles.add(identifier);
    }
  }

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
    profilesProcessed: profiles.length,
    profilesRejected: rejectedProfiles.size,
  };
}

/**
 * Filter profiles based on enforcement results
 */
export function filterEnforcedProfiles(
  profiles: ValidatedProfile[],
  result: EnforcementResult
): ValidatedProfile[] {
  if (result.passed) {
    return profiles;
  }

  // Build set of rejected profile identifiers
  const rejectedIdentifiers = new Set(
    result.violations
      .filter(v => v.severity === 'error')
      .map(v => v.profileIdentifier)
      .filter((id): id is string => id !== undefined)
  );

  // Filter out rejected profiles
  return profiles.filter(profile => {
    const identifier = profile.name || profile.handle || 'unknown';
    return !rejectedIdentifiers.has(identifier);
  });
}
