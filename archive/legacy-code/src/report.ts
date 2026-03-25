// @crumb backend-report-generator
// OBS | markdown_report_assembly | gating_config_metadata_embedding | citation_formatting | report_file_write
// why: Report generation — transform validated profiles into a structured markdown report with metadata, methodology, validated profiles (max 20) with citations, source list, and research limitations
// in:ValidatedProfile[] (post-enforcement), GatingConfig, fs.promises for file write, path for output directory out:Markdown report string; report.md written to disk err:File write failure (throws, caller must handle); empty profiles array generates "no profiles found" section
// hazard: Report is written to a hardcoded filename ('report.md') — concurrent pipeline runs will overwrite each other's reports
// hazard: Profile cap is hardcoded at 20 — config parameterization silently ignored
// edge:src/types.ts -> READS
// edge:src/quality.ts -> SERVES
// edge:src/index.ts -> SERVES
// edge:report#1 -> STEP_IN
// prompt: Parameterize output path and profile cap via config. Add run ID to report filename to prevent overwrites. Consider JSON report output format alongside markdown.

/**
 * Structured Research Report Generator
 *
 * Transforms validated profiles into a structured markdown report with:
 * - Metadata: agent name, execution date, search parameters
 * - Methodology: validation rules and signal framework
 * - Validated profiles (max 20) with citations
 * - Complete source list
 * - Research limitations
 */

import { ValidatedProfile, GatingConfig, SignalName } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Report metadata captured at generation time
 */
export interface ReportMetadata {
  agentName: string;
  executionDate: Date;
  roleFocus: string;
  languages: string[];
  evidencePriorities: string[];
  profilesReviewed: number;
  profilesReturned: number;
  geography?: string;
}

/**
 * Complete report structure
 */
export interface ResearchReport {
  metadata: ReportMetadata;
  profiles: ValidatedProfile[];
  generatedAt: Date;
}

/**
 * Generate report metadata from gating config and validation results
 */
export function createReportMetadata(
  config: GatingConfig,
  profilesReviewed: number,
  profilesReturned: number
): ReportMetadata {
  return {
    agentName: 'CodeSignal-20 Citation-First Research Agent',
    executionDate: new Date(),
    roleFocus: config.engineeringFocus,
    languages: config.languages,
    evidencePriorities: config.evidencePriorities,
    profilesReviewed,
    profilesReturned,
    geography: config.geography || undefined
  };
}

/**
 * Generate markdown report from validated profiles
 */
export function generateMarkdownReport(report: ResearchReport): string {
  const lines: string[] = [];
  const { metadata, profiles } = report;

  // Header and critical disclaimer
  lines.push('# Software Engineering Research Report');
  lines.push('');
  lines.push('**⚠️ CRITICAL: This is research input requiring human review before any outreach.**');
  lines.push('**This is not an evaluation or ranking.**');
  lines.push('');

  // Metadata section
  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Agent**: ${metadata.agentName}`);
  lines.push(`- **Execution Date**: ${metadata.executionDate.toISOString().split('T')[0]}`);
  lines.push(`- **Role Focus**: ${metadata.roleFocus}`);
  lines.push(`- **Languages**: ${metadata.languages.join(', ')}`);
  lines.push(`- **Evidence Priorities**: ${metadata.evidencePriorities.join(', ')}`);
  if (metadata.geography) {
    lines.push(`- **Geography**: ${metadata.geography}`);
  }
  lines.push(`- **Profiles Reviewed**: ${metadata.profilesReviewed}`);
  lines.push(`- **Profiles Returned**: ${metadata.profilesReturned}`);
  lines.push('');

  // Methodology section
  lines.push('## Methodology');
  lines.push('');
  lines.push('This report uses a **citation-first validation framework** with the following rules:');
  lines.push('');
  lines.push('### Five Signal Framework');
  lines.push('');
  lines.push('Each candidate is evaluated against five binary signals:');
  lines.push('');
  lines.push('1. **Code Signal**: Non-trivial repositories, meaningful pull requests, substantive commits');
  lines.push('2. **Depth Signal**: Systems/infrastructure/performance/scaling concerns demonstrated');
  lines.push('3. **Sustained Activity**: Evidence of technical work spanning 12+ months');
  lines.push('4. **Thinking Signal**: Technical blogs, RFCs, long-form explanations, documented reasoning');
  lines.push('5. **Peer Recognition**: Accepted PRs, referenced work, high-signal Stack Overflow contributions');
  lines.push('');
  lines.push('### Inclusion Criteria');
  lines.push('');
  lines.push('- **Minimum signals**: 3 or more signals must be present');
  lines.push('- **Citation requirement**: Each signal requires at least one verifiable URL');
  lines.push('- **No inferred skill**: Job titles are NOT used as evidence');
  lines.push('- **No paraphrasing**: Claims based on direct inspection of artefacts only');
  lines.push('');
  lines.push('### Quality Gates');
  lines.push('');
  lines.push('1. **Source Registry Enforcement**: Only approved public sources (GitHub, blogs, conferences, Stack Overflow)');
  lines.push('2. **Signal Validation**: Binary present/absent evaluation, no weighting or scoring');
  lines.push('3. **Hallucination Control**: Every factual statement requires a URL citation');
  lines.push('4. **Contradiction Handling**: Conflicting evidence causes automatic profile exclusion');
  lines.push('');

  // Validated profiles section
  lines.push('## Validated Profiles');
  lines.push('');

  if (profiles.length === 0) {
    lines.push('*No profiles met the validation criteria.*');
    lines.push('');
  } else {
    profiles.forEach((profile, index) => {
      lines.push(`### ${index + 1}. ${profile.name}${profile.handle ? ` (@${profile.handle})` : ''}`);
      lines.push('');

      // Summary line
      const signalNames = Object.entries(profile.signals)
        .filter(([_, present]) => present)
        .map(([name]) => name);

      lines.push(`**Primary Languages**: ${profile.languages.join(', ')}`);
      lines.push(`**Engineering Focus**: ${profile.engineeringFocus}`);
      if (profile.geography) {
        lines.push(`**Geography**: ${profile.geography}`);
      }
      lines.push(`**Signals Present**: ${signalNames.join(', ')} (${signalNames.length}/5)`);
      lines.push('');

      // Verified evidence with citations
      lines.push('**Verified Evidence**:');
      lines.push('');

      // Group citations by signal for cleaner presentation
      const citationsBySignal = new Map<SignalName, typeof profile.citations>();
      profile.citations.forEach(citation => {
        if (!citationsBySignal.has(citation.signal)) {
          citationsBySignal.set(citation.signal, []);
        }
        citationsBySignal.get(citation.signal)!.push(citation);
      });

      // Output citations in signal order
      const signalOrder: SignalName[] = ['code', 'depth', 'sustained', 'thinking', 'peer'];
      signalOrder.forEach(signal => {
        const signalCitations = citationsBySignal.get(signal);
        if (signalCitations && signalCitations.length > 0) {
          signalCitations.forEach(citation => {
            lines.push(`- ${citation.description} ([source](${citation.url}))`);
          });
        }
      });

      lines.push('');

      // Synthesis from cited facts
      lines.push('**Synthesis**:');
      lines.push('');
      lines.push(generateProfileSynthesis(profile));
      lines.push('');

      // Primary URL reference
      lines.push(`**Primary URL**: ${profile.primaryUrl}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    });
  }

  // Complete source list
  lines.push('## Sources');
  lines.push('');

  const allUrls = new Set<string>();
  profiles.forEach(profile => {
    allUrls.add(profile.primaryUrl);
    profile.citations.forEach(citation => {
      allUrls.add(citation.url);
    });
  });

  const sortedUrls = Array.from(allUrls).sort();

  if (sortedUrls.length === 0) {
    lines.push('*No sources available.*');
  } else {
    lines.push(`This report references **${sortedUrls.length} unique sources**:`);
    lines.push('');
    sortedUrls.forEach(url => {
      lines.push(`- ${url}`);
    });
  }
  lines.push('');

  // Research limitations
  lines.push('## Research Limitations');
  lines.push('');
  lines.push('This research is subject to the following limitations:');
  lines.push('');
  lines.push('1. **Public Artefacts Only**: Engineers without public GitHub profiles, blogs, or conference talks are invisible to this method');
  lines.push('2. **Language Bias**: Search prioritizes activity in the specified languages, potentially missing polyglot engineers');
  lines.push('3. **Recency Bias**: Active contributors in the past 12-24 months are more discoverable than those with older work');
  lines.push('4. **Platform Dependency**: Relies heavily on GitHub, technical blogs, and YouTube—engineers primarily active on other platforms may be underrepresented');
  lines.push('5. **Citation Availability**: Some valuable work may lack public citations or clear authorship attribution');
  lines.push('6. **Geographic Constraints**: Geographic filters rely on self-reported location data in profiles, which may be incomplete or outdated');
  lines.push('7. **Depth vs Breadth**: Prioritizing depth signals may exclude talented generalists or early-career engineers building expertise');
  lines.push('8. **Web Search Coverage**: Discovery depends on web search API quality and indexing completeness at the time of execution');
  lines.push('9. **Validation Gaps**: Binary signal evaluation cannot capture nuanced differences in skill level or specialization within domains');
  lines.push('10. **No Seniority Assessment**: Deliberately excludes job title and tenure-based seniority signals, which some organizations may require');
  lines.push('');
  lines.push('**Recommendation**: Use this report as a **research input** to identify candidates for further human review, not as a final ranking or evaluation.');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated by ${metadata.agentName} on ${metadata.executionDate.toISOString()}*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate synthesis paragraph from profile citations
 *
 * Synthesis rules:
 * - State only facts directly supported by citations
 * - No inferences about seniority or skill level
 * - Focus on observable artefacts and their technical characteristics
 */
function generateProfileSynthesis(profile: ValidatedProfile): string {
  const parts: string[] = [];

  // Count signals
  const signalCount = Object.values(profile.signals).filter(Boolean).length;

  parts.push(`This profile demonstrates ${signalCount} of 5 validation signals.`);

  // Code signal synthesis
  if (profile.signals.code) {
    const codeCitations = profile.citations.filter(c => c.signal === 'code');
    if (codeCitations.length > 0) {
      parts.push(`Code contributions include ${codeCitations.length} verifiable artefact${codeCitations.length > 1 ? 's' : ''}.`);
    }
  }

  // Depth signal synthesis
  if (profile.signals.depth) {
    const depthCitations = profile.citations.filter(c => c.signal === 'depth');
    if (depthCitations.length > 0) {
      parts.push(`Technical depth is evidenced by work on systems-level concerns.`);
    }
  }

  // Sustained signal synthesis
  if (profile.signals.sustained) {
    parts.push(`Activity shows sustained engagement over time.`);
  }

  // Thinking signal synthesis
  if (profile.signals.thinking) {
    const thinkingCitations = profile.citations.filter(c => c.signal === 'thinking');
    if (thinkingCitations.length > 0) {
      parts.push(`Documented technical reasoning found across ${thinkingCitations.length} written artefact${thinkingCitations.length > 1 ? 's' : ''}.`);
    }
  }

  // Peer signal synthesis
  if (profile.signals.peer) {
    parts.push(`Peer recognition demonstrated through accepted contributions or referenced work.`);
  }

  // Primary language focus
  if (profile.languages.length > 0) {
    const langList = profile.languages.slice(0, 2).join(' and ');
    parts.push(`Primary technical focus areas include ${langList}.`);
  }

  return parts.join(' ');
}

/**
 * Cap profiles to maximum of 20
 */
export function capProfiles(profiles: ValidatedProfile[]): ValidatedProfile[] {
  const MAX_PROFILES = 20;
  if (profiles.length <= MAX_PROFILES) {
    return profiles;
  }

  // Take first 20 profiles (assumes profiles are already sorted by quality/relevance)
  return profiles.slice(0, MAX_PROFILES);
}

/**
 * Write markdown report to disk
 */
export async function writeReportToDisk(
  markdown: string,
  outputPath: string
): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  // Write report
  await fs.writeFile(outputPath, markdown, 'utf-8');
}

/**
 * Generate and save complete research report
 */
export async function generateResearchReport(
  config: GatingConfig,
  profiles: ValidatedProfile[],
  profilesReviewed: number,
  outputPath: string
): Promise<ResearchReport> {
  // Cap to max 20 profiles
  const cappedProfiles = capProfiles(profiles);

  // Create metadata
  const metadata = createReportMetadata(config, profilesReviewed, cappedProfiles.length);

  // Build report structure
  const report: ResearchReport = {
    metadata,
    profiles: cappedProfiles,
    generatedAt: new Date()
  };

  // Generate markdown
  const markdown = generateMarkdownReport(report);

  // Write to disk
  await writeReportToDisk(markdown, outputPath);

  return report;
}
