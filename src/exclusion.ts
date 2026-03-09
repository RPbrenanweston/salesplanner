/**
 * @crumb
 * @id backend-exclusion-persistence
 * @area DAT
 * @intent Exclusion persistence — maintain a persistent list of previously returned candidates to prevent re-surfacing the same profiles across multiple search runs
 * @responsibilities Load exclusion list from JSON file, add new candidates to exclusion list, filter candidate arrays against exclusion list, save updated exclusion list to disk
 * @contracts loadExclusions(path?) → Promise<ExclusionList>; saveExclusions(list, path?) → Promise<void>; addToExclusions(list, candidate) → ExclusionList; filterExcluded(candidates[], list) → DiscoveredCandidate[]; isExcluded(candidate, list) → bool
 * @in exclusions.json file (or default path), DiscoveredCandidate[] for filtering
 * @out ExclusionList (Set/Map of excluded candidate identifiers); filtered DiscoveredCandidate[] with previously seen profiles removed
 * @err File read failure (exclusions.json missing — returns empty list, not an error); JSON.parse failure (malformed exclusions.json — error thrown, caller must handle)
 * @hazard Exclusion list grows unboundedly — every candidate added is never removed; over many runs the exclusions.json file will grow large and slow down I/O, especially on slow filesystems or cloud volumes
 * @hazard Exclusion matching uses candidate handle or primaryUrl as key — if a candidate's GitHub handle changes or they update their primary URL, the same person may re-appear in results as a new candidate despite being previously excluded
 * @shared-edges src/index.ts→CALLS load/save/filterExcluded; src/discovery.ts→CANDIDATES filtered here before validation; ./exclusions.json→READS and WRITES
 * @trail exclusion#1 | index.ts loads exclusions → discovery returns candidates → filterExcluded removes previously seen → remaining validated → new candidates added to exclusions → list saved
 * @prompt Add exclusion list TTL (expire entries after N days). Consider using primaryUrl as primary exclusion key with handle as fallback. Add exclusion count to run statistics.
 */

/**
 * Exclusion system for iterative candidate discovery
 *
 * Maintains a persistent list of previously returned candidates to prevent
 * re-surfacing the same high-scoring profiles across multiple search runs.
 */

import * as fs from 'fs/promises';
import type { ValidatedProfile } from './types.js';
import type { GatingConfig } from './types.js';

/**
 * Identifier for an excluded candidate
 */
export interface ExcludedCandidate {
  /** Candidate name */
  name: string;
  /** Primary URL used as unique identifier */
  primaryUrl: string;
  /** When this candidate was excluded */
  excludedAt: string;
  /** Search context that excluded them */
  searchContext: string;
}

/**
 * Type alias for database compatibility
 */
export type ExclusionEntry = ExcludedCandidate;

/**
 * Exclusion list structure
 */
export interface ExclusionList {
  /** All excluded candidates across all runs */
  excluded: ExcludedCandidate[];
  /** Timestamp of last update */
  lastUpdated: string;
}

/**
 * Feedback types for calibration
 */
export type FeedbackType = 'show_more' | 'calibrate' | 'include_override';

/**
 * Parsed feedback result
 */
export interface ParsedFeedback {
  type: FeedbackType;
  /** Calibration adjustments to gating config */
  calibration?: Partial<GatingConfig>;
  /** Candidate identifiers to remove from exclusion list */
  includeOverrides?: string[];
}

const EXCLUSIONS_FILE = 'exclusions.json';

/**
 * Load exclusion list from disk
 */
export async function loadExclusions(): Promise<ExclusionList> {
  try {
    const content = await fs.readFile(EXCLUSIONS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is invalid - return empty list
    return {
      excluded: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Save exclusion list to disk
 */
export async function saveExclusions(list: ExclusionList): Promise<void> {
  const updated: ExclusionList = {
    ...list,
    lastUpdated: new Date().toISOString(),
  };
  await fs.writeFile(EXCLUSIONS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
}

/**
 * Add validated profiles to exclusion list
 *
 * Called after report generation to prevent re-surfacing these candidates
 */
export async function addToExclusions(
  profiles: ValidatedProfile[],
  searchContext: string
): Promise<ExclusionList> {
  const list = await loadExclusions();

  const newExclusions: ExcludedCandidate[] = profiles.map(profile => ({
    name: profile.name,
    primaryUrl: profile.primaryUrl,
    excludedAt: new Date().toISOString(),
    searchContext,
  }));

  // Deduplicate by primaryUrl (in case profile already excluded)
  const existingUrls = new Set(list.excluded.map(e => e.primaryUrl));
  const uniqueNewExclusions = newExclusions.filter(e => !existingUrls.has(e.primaryUrl));

  const updated: ExclusionList = {
    excluded: [...list.excluded, ...uniqueNewExclusions],
    lastUpdated: new Date().toISOString(),
  };

  await saveExclusions(updated);
  return updated;
}

/**
 * Remove candidates from exclusion list (explicit override)
 */
export async function removeFromExclusions(primaryUrls: string[]): Promise<ExclusionList> {
  const list = await loadExclusions();

  const urlSet = new Set(primaryUrls);
  const updated: ExclusionList = {
    excluded: list.excluded.filter(e => !urlSet.has(e.primaryUrl)),
    lastUpdated: new Date().toISOString(),
  };

  await saveExclusions(updated);
  return updated;
}

/**
 * Filter profiles against exclusion list
 *
 * Removes any profile whose primaryUrl appears in the exclusion list
 */
export function filterExcludedProfiles(
  profiles: ValidatedProfile[],
  exclusions: ExclusionList
): ValidatedProfile[] {
  const excludedUrls = new Set(exclusions.excluded.map(e => e.primaryUrl));
  return profiles.filter(p => !excludedUrls.has(p.primaryUrl));
}

/**
 * Get exclusion count
 */
export function getExclusionCount(exclusions: ExclusionList): number {
  return exclusions.excluded.length;
}

/**
 * Parse feedback text to determine intent and calibration
 *
 * Detects:
 * - "show me 20 more" / "more candidates" → show_more
 * - "more systems-focused" / "less frontend" → calibrate with adjustments
 * - "include [name] again" → include_override
 */
export function parseFeedback(feedback: string): ParsedFeedback {
  const lower = feedback.toLowerCase().trim();

  // Check for explicit include override
  const includeMatch = lower.match(/include\s+(.+?)\s+again/);
  if (includeMatch) {
    return {
      type: 'include_override',
      includeOverrides: [includeMatch[1].trim()],
    };
  }

  // Check for "show more" variants
  if (
    lower.includes('show me') && lower.includes('more') ||
    lower.includes('more candidates') ||
    lower.includes('next batch') ||
    lower === 'more'
  ) {
    return { type: 'show_more' };
  }

  // Check for calibration signals
  const calibration: Partial<GatingConfig> = {};
  let hasCalibration = false;

  // Focus calibration
  if (lower.includes('more systems') || lower.includes('more backend')) {
    calibration.engineeringFocus = 'Backend/Systems';
    hasCalibration = true;
  }
  if (lower.includes('less frontend') || lower.includes('no frontend')) {
    calibration.engineeringFocus = 'Backend/Systems';
    hasCalibration = true;
  }
  if (lower.includes('more frontend')) {
    calibration.engineeringFocus = 'Frontend';
    hasCalibration = true;
  }
  if (lower.includes('more full stack') || lower.includes('full-stack')) {
    calibration.engineeringFocus = 'Full Stack';
    hasCalibration = true;
  }

  // Depth calibration
  if (lower.includes('more distributed') || lower.includes('more systems')) {
    calibration.depthExpectation = 'Distributed systems and infrastructure';
    hasCalibration = true;
  }
  if (lower.includes('more infrastructure') || lower.includes('more devops')) {
    calibration.depthExpectation = 'Infrastructure and DevOps';
    hasCalibration = true;
  }

  // Geography calibration
  const geoMatch = lower.match(/(?:in|from|based in)\s+(\w+(?:\s+\w+)?)/);
  if (geoMatch) {
    calibration.geography = geoMatch[1].trim();
    hasCalibration = true;
  }

  if (hasCalibration) {
    return {
      type: 'calibrate',
      calibration,
    };
  }

  // Default to show_more if no specific pattern matched
  return { type: 'show_more' };
}

/**
 * Apply calibration to gating config
 *
 * Merges calibration adjustments into existing config
 */
export function applyCalibration(
  config: GatingConfig,
  calibration: Partial<GatingConfig>
): GatingConfig {
  return {
    ...config,
    ...calibration,
  };
}

/**
 * Get search context string for exclusion tracking
 */
export function getSearchContext(config: GatingConfig): string {
  const langs = config.languages.join(', ');
  return `${config.engineeringFocus} | ${langs} | ${config.depthExpectation}`;
}
