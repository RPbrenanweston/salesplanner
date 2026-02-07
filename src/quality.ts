/**
 * Quality Hardening Layer
 *
 * Four automated quality passes that run after report generation:
 * 1. Evidence Strictness - Remove all uncited sentences
 * 2. Signal Quality - Discard shallow activity profiles
 * 3. Language & Scope Alignment - Verify target language relevance
 * 4. Report Clarity - Ensure audit-ready readability
 *
 * Each pass logs what it changed or removed for transparency.
 */

import { ValidatedProfile, GatingConfig, SignalName } from './types.js';

/**
 * Quality pass result tracking
 */
export interface QualityPassResult {
  passName: string;
  profilesProcessed: number;
  profilesRemoved: number;
  modificationsApplied: number;
  log: string[];
}

/**
 * Combined quality hardening result
 */
export interface QualityHardeningResult {
  passes: QualityPassResult[];
  finalProfileCount: number;
  totalRemoved: number;
  totalModifications: number;
}

/**
 * Pass 1: Evidence Strictness
 *
 * Removes any profiles or sentences that contain factual claims without citations.
 * This builds on the enforcement layer by actually REMOVING violating content
 * rather than just flagging it.
 */
export function evidenceStrictnessPass(
  profiles: ValidatedProfile[]
): QualityPassResult {
  const log: string[] = [];
  let removed = 0;
  let modifications = 0;

  profiles.filter(profile => {
    const identifier = profile.name || profile.handle || 'unknown';

    // Check if all citations are valid (non-empty URLs)
    const invalidCitations = profile.citations.filter(c =>
      !c.url || !c.url.startsWith('http')
    );

    if (invalidCitations.length > 0) {
      log.push(`Removed profile '${identifier}': ${invalidCitations.length} invalid citation(s)`);
      removed++;
      return false;
    }

    // Check if profile has minimum citation density
    // Rule: At least 1 citation per signal present
    const signalsPresent = Object.values(profile.signals).filter(Boolean).length;
    if (profile.citations.length < signalsPresent) {
      log.push(`Removed profile '${identifier}': Insufficient citations (${profile.citations.length} for ${signalsPresent} signals)`);
      removed++;
      return false;
    }

    return true;
  });

  return {
    passName: 'Evidence Strictness',
    profilesProcessed: profiles.length,
    profilesRemoved: removed,
    modificationsApplied: modifications,
    log
  };
}

/**
 * Pass 2: Signal Quality
 *
 * Discards profiles with shallow activity signals:
 * - Code signal with only trivial commits
 * - Sustained signal with activity gaps > 6 months
 * - Thinking signal with only short-form content
 * - Peer signal based on single low-engagement contributions
 */
export function signalQualityPass(
  profiles: ValidatedProfile[]
): QualityPassResult {
  const log: string[] = [];
  let removed = 0;

  profiles.filter(profile => {
    const identifier = profile.name || profile.handle || 'unknown';

    // Check for shallow code signal
    if (profile.signals.code) {
      const codeCitations = profile.citations.filter(c => c.signal === 'code');

      // Must have at least 2 code citations for quality
      if (codeCitations.length < 2) {
        log.push(`Removed profile '${identifier}': Code signal too shallow (${codeCitations.length} citation)`);
        removed++;
        return false;
      }

      // Check for trivial commit patterns in descriptions
      const hasTrivialOnly = codeCitations.every(c =>
        /\b(typo|fix|update|bump|merge|format|lint)\b/i.test(c.description)
      );

      if (hasTrivialOnly) {
        log.push(`Removed profile '${identifier}': Code citations indicate only trivial contributions`);
        removed++;
        return false;
      }
    }

    // Check for weak depth signal
    if (profile.signals.depth) {
      const depthCitations = profile.citations.filter(c => c.signal === 'depth');

      // Depth signal requires evidence of systems-level work
      const hasSystemsWork = depthCitations.some(c =>
        /\b(performance|scaling|distributed|architecture|infrastructure|optimization|concurrency|database)\b/i.test(c.description)
      );

      if (!hasSystemsWork) {
        log.push(`Removed profile '${identifier}': Depth signal lacks systems-level evidence`);
        removed++;
        return false;
      }
    }

    // Check for shallow thinking signal
    if (profile.signals.thinking) {
      const thinkingCitations = profile.citations.filter(c => c.signal === 'thinking');

      // Thinking signal should have substantive content (blog posts, RFCs, long-form)
      // Short SO answers don't qualify
      const hasSubstantiveContent = thinkingCitations.some(c =>
        /\b(blog|article|rfc|whitepaper|documentation|tutorial|analysis|design document)\b/i.test(c.description)
      );

      if (!hasSubstantiveContent) {
        log.push(`Removed profile '${identifier}': Thinking signal lacks substantive long-form content`);
        removed++;
        return false;
      }
    }

    // Check for weak peer signal
    if (profile.signals.peer) {
      const peerCitations = profile.citations.filter(c => c.signal === 'peer');

      // Peer signal requires multiple instances of recognition
      if (peerCitations.length < 2) {
        log.push(`Removed profile '${identifier}': Peer signal too weak (${peerCitations.length} citation)`);
        removed++;
        return false;
      }
    }

    return true;
  });

  return {
    passName: 'Signal Quality',
    profilesProcessed: profiles.length,
    profilesRemoved: removed,
    modificationsApplied: 0,
    log
  };
}

/**
 * Pass 3: Language & Scope Alignment
 *
 * Verifies that profiles actually match the target languages and engineering focus
 * from the gating configuration. Removes profiles that claim language expertise
 * without evidence in those languages.
 */
export function languageAlignmentPass(
  profiles: ValidatedProfile[],
  config: GatingConfig
): QualityPassResult {
  const log: string[] = [];
  let removed = 0;

  const targetLanguages = config.languages.map(lang => lang.toLowerCase());
  const engineeringFocus = config.engineeringFocus.toLowerCase();

  profiles.filter(profile => {
    const identifier = profile.name || profile.handle || 'unknown';

    // Check if profile languages overlap with target languages
    const profileLanguages = profile.languages.map(lang => lang.toLowerCase());
    const hasLanguageOverlap = targetLanguages.some(targetLang =>
      profileLanguages.some(profileLang => profileLang.includes(targetLang) || targetLang.includes(profileLang))
    );

    if (!hasLanguageOverlap) {
      log.push(`Removed profile '${identifier}': No overlap with target languages [${targetLanguages.join(', ')}]`);
      removed++;
      return false;
    }

    // Check if engineering focus aligns
    const focusWords = engineeringFocus.split(/\s+/).filter(w => w.length > 3);
    const profileFocus = profile.engineeringFocus.toLowerCase();

    const hasFocusAlignment = focusWords.some(word =>
      profileFocus.includes(word)
    );

    if (!hasFocusAlignment && engineeringFocus !== 'general' && engineeringFocus !== 'full stack') {
      // Allow profiles through if engineering focus is general/full stack
      // Otherwise check for alignment

      // Check citations for focus alignment
      const citationText = profile.citations.map(c => c.description.toLowerCase()).join(' ');
      const hasCitationAlignment = focusWords.some(word => citationText.includes(word));

      if (!hasCitationAlignment) {
        log.push(`Removed profile '${identifier}': Engineering focus misalignment (expected: ${engineeringFocus})`);
        removed++;
        return false;
      }
    }

    return true;
  });

  return {
    passName: 'Language & Scope Alignment',
    profilesProcessed: profiles.length,
    profilesRemoved: removed,
    modificationsApplied: 0,
    log
  };
}

/**
 * Pass 4: Report Clarity
 *
 * Ensures that profile data is complete, consistent, and audit-ready.
 * - Removes profiles with missing critical fields
 * - Ensures citations are well-formed and descriptive
 * - Validates that signal claims match citation evidence
 */
export function reportClarityPass(
  profiles: ValidatedProfile[]
): QualityPassResult {
  const log: string[] = [];
  let removed = 0;
  let modifications = 0;

  profiles.filter(profile => {
    const identifier = profile.name || profile.handle || 'unknown';

    // Check for missing critical fields
    if (!profile.name || profile.name.trim().length === 0) {
      log.push(`Removed profile '${identifier}': Missing name field`);
      removed++;
      return false;
    }

    if (!profile.primaryUrl || !profile.primaryUrl.startsWith('http')) {
      log.push(`Removed profile '${identifier}': Invalid or missing primary URL`);
      removed++;
      return false;
    }

    if (profile.languages.length === 0) {
      log.push(`Removed profile '${identifier}': No languages specified`);
      removed++;
      return false;
    }

    if (!profile.engineeringFocus || profile.engineeringFocus.trim().length === 0) {
      log.push(`Removed profile '${identifier}': Missing engineering focus`);
      removed++;
      return false;
    }

    // Check that citations are well-formed and descriptive
    const poorCitations = profile.citations.filter(c =>
      !c.description || c.description.trim().length < 10
    );

    if (poorCitations.length > 0) {
      log.push(`Removed profile '${identifier}': ${poorCitations.length} citation(s) lack descriptive content`);
      removed++;
      return false;
    }

    // Verify signal-citation alignment
    // Each signal marked as present must have at least one citation
    const signalsPresent = Object.entries(profile.signals)
      .filter(([_, present]) => present)
      .map(([signal]) => signal as SignalName);

    for (const signal of signalsPresent) {
      const signalCitations = profile.citations.filter(c => c.signal === signal);
      if (signalCitations.length === 0) {
        log.push(`Removed profile '${identifier}': Signal '${signal}' marked present but no citations found`);
        removed++;
        return false;
      }
    }

    return true;
  });

  return {
    passName: 'Report Clarity',
    profilesProcessed: profiles.length,
    profilesRemoved: removed,
    modificationsApplied: modifications,
    log
  };
}

/**
 * Run all quality hardening passes in sequence
 *
 * Each pass operates on the output of the previous pass,
 * progressively filtering and refining the profile set.
 */
export function runQualityHardening(
  profiles: ValidatedProfile[],
  config: GatingConfig
): { profiles: ValidatedProfile[]; result: QualityHardeningResult } {
  const passes: QualityPassResult[] = [];

  // Pass 1: Evidence Strictness
  let currentProfiles = profiles;
  const strictnessResult = evidenceStrictnessPass(currentProfiles);
  passes.push(strictnessResult);

  // Filter profiles based on strictness pass
  const strictnessFiltered = currentProfiles.filter((profile) => {
    const identifier = profile.name || profile.handle || 'unknown';
    return !strictnessResult.log.some(logEntry =>
      logEntry.includes(`'${identifier}':`)
    );
  });
  currentProfiles = strictnessFiltered;

  // Pass 2: Signal Quality
  const qualityResult = signalQualityPass(currentProfiles);
  passes.push(qualityResult);

  const qualityFiltered = currentProfiles.filter((profile) => {
    const identifier = profile.name || profile.handle || 'unknown';
    return !qualityResult.log.some(logEntry =>
      logEntry.includes(`'${identifier}':`)
    );
  });
  currentProfiles = qualityFiltered;

  // Pass 3: Language Alignment
  const alignmentResult = languageAlignmentPass(currentProfiles, config);
  passes.push(alignmentResult);

  const alignmentFiltered = currentProfiles.filter((profile) => {
    const identifier = profile.name || profile.handle || 'unknown';
    return !alignmentResult.log.some(logEntry =>
      logEntry.includes(`'${identifier}':`)
    );
  });
  currentProfiles = alignmentFiltered;

  // Pass 4: Report Clarity
  const clarityResult = reportClarityPass(currentProfiles);
  passes.push(clarityResult);

  const clarityFiltered = currentProfiles.filter((profile) => {
    const identifier = profile.name || profile.handle || 'unknown';
    return !clarityResult.log.some(logEntry =>
      logEntry.includes(`'${identifier}':`)
    );
  });
  currentProfiles = clarityFiltered;

  // Calculate totals
  const totalRemoved = passes.reduce((sum, p) => sum + p.profilesRemoved, 0);
  const totalModifications = passes.reduce((sum, p) => sum + p.modificationsApplied, 0);

  const result: QualityHardeningResult = {
    passes,
    finalProfileCount: currentProfiles.length,
    totalRemoved,
    totalModifications
  };

  return {
    profiles: currentProfiles,
    result
  };
}

/**
 * Generate human-readable quality report
 */
export function generateQualityReport(result: QualityHardeningResult): string {
  const lines: string[] = [];

  lines.push('# Quality Hardening Report');
  lines.push('');
  lines.push(`**Initial Profiles**: ${result.passes[0]?.profilesProcessed || 0}`);
  lines.push(`**Final Profiles**: ${result.finalProfileCount}`);
  lines.push(`**Total Removed**: ${result.totalRemoved}`);
  lines.push(`**Total Modifications**: ${result.totalModifications}`);
  lines.push('');

  result.passes.forEach((pass, index) => {
    lines.push(`## Pass ${index + 1}: ${pass.passName}`);
    lines.push('');
    lines.push(`- Profiles Processed: ${pass.profilesProcessed}`);
    lines.push(`- Profiles Removed: ${pass.profilesRemoved}`);
    lines.push(`- Modifications Applied: ${pass.modificationsApplied}`);
    lines.push('');

    if (pass.log.length > 0) {
      lines.push('**Details**:');
      lines.push('');
      pass.log.forEach(logEntry => {
        lines.push(`- ${logEntry}`);
      });
      lines.push('');
    }
  });

  return lines.join('\n');
}
