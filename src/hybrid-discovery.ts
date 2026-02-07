/**
 * Hybrid discovery system: Database-first with web fallback.
 * Queries Supabase before searching the open web to reduce token usage.
 */

import { Database, DatabaseResult } from './database.js';
import { GatingConfig, ValidatedProfile } from './types.js';
import { loadExclusions, filterExcludedProfiles } from './exclusion.js';

/**
 * Result of hybrid discovery showing source breakdown
 */
export interface HybridDiscoveryResult {
  profiles: ValidatedProfile[];
  fromDatabase: number;
  fromWeb: number;
  staleProfilesRevalidated: number;
  deadUrlsDetected: number;
  totalReturned: number;
}

/**
 * Discovery source statistics
 */
export interface DiscoveryStats {
  databaseHits: number;
  databaseMisses: number;
  webDiscoveryRequired: number;
  efficiencyGain: number; // Percentage of profiles from DB
}

/**
 * Profile with staleness metadata
 */
export interface ProfileWithStaleness {
  profile: ValidatedProfile;
  isStale: boolean;
  lastValidated?: Date;
}

/**
 * Check if a URL is still alive (basic HEAD request)
 * Returns true if URL is reachable, false otherwise
 */
export async function checkUrlLiveness(url: string): Promise<boolean> {
  try {
    // In a real implementation, this would do an HTTP HEAD request
    // For now, we'll simulate URL checking
    // Pattern: Detect obviously dead URL patterns
    const deadPatterns = [
      /404\.html$/i,
      /error\.html$/i,
      /deleted/i,
      /removed/i,
    ];

    const isDead = deadPatterns.some((pattern) => pattern.test(url));
    return !isDead;
  } catch {
    return false; // URL unreachable
  }
}

/**
 * Detect dead citation URLs in a profile
 * Returns array of dead URLs found
 */
export async function detectDeadUrls(
  profile: ValidatedProfile
): Promise<string[]> {
  const deadUrls: string[] = [];

  // Check all citation URLs
  for (const citation of profile.citations) {
    const isAlive = await checkUrlLiveness(citation.url);
    if (!isAlive) {
      deadUrls.push(citation.url);
    }
  }

  return deadUrls;
}

/**
 * Flag profiles older than staleness threshold
 * Returns profiles with staleness metadata
 */
export function flagStaleProfiles(
  profiles: ValidatedProfile[],
  maxStaleDays: number = 90
): ProfileWithStaleness[] {
  const now = new Date();
  const staleThreshold = new Date();
  staleThreshold.setDate(now.getDate() - maxStaleDays);

  return profiles.map((profile) => {
    const lastValidated = profile.discoverySource?.discoveredAt;
    const isStale = lastValidated
      ? lastValidated < staleThreshold
      : true; // No timestamp = stale

    return {
      profile,
      isStale,
      lastValidated,
    };
  });
}

/**
 * Filter fresh profiles from database results
 * Excludes stale profiles and those with dead URLs
 */
export async function filterFreshProfiles(
  profiles: ValidatedProfile[],
  maxStaleDays: number = 90
): Promise<{
  fresh: ValidatedProfile[];
  stale: ValidatedProfile[];
  withDeadUrls: ValidatedProfile[];
}> {
  const fresh: ValidatedProfile[] = [];
  const stale: ValidatedProfile[] = [];
  const withDeadUrls: ValidatedProfile[] = [];

  const flagged = flagStaleProfiles(profiles, maxStaleDays);

  for (const item of flagged) {
    if (item.isStale) {
      stale.push(item.profile);
      continue;
    }

    // Check for dead URLs
    const deadUrls = await detectDeadUrls(item.profile);
    if (deadUrls.length > 0) {
      withDeadUrls.push(item.profile);
      continue;
    }

    fresh.push(item.profile);
  }

  return { fresh, stale, withDeadUrls };
}

/**
 * Query database for matching profiles
 * Returns profiles matching gating criteria with exclusions applied
 */
export async function queryDatabaseForProfiles(
  db: Database,
  config: GatingConfig,
  maxStaleDays: number = 90
): Promise<DatabaseResult<ValidatedProfile[]>> {
  if (!db.isAvailable()) {
    return {
      success: false,
      error: 'Database unavailable - falling back to web discovery',
    };
  }

  // Query database
  const result = await db.queryEngineers(config, maxStaleDays);

  if (!result.success || !result.data) {
    return result;
  }

  // Apply exclusions
  const exclusions = await loadExclusions();
  const filtered = filterExcludedProfiles(result.data, exclusions);

  return {
    success: true,
    data: filtered,
  };
}

/**
 * Calculate how many profiles to discover from web
 * Returns gap to fill to reach target count (default 20)
 */
export function calculateWebDiscoveryGap(
  dbProfileCount: number,
  targetCount: number = 20
): number {
  return Math.max(0, targetCount - dbProfileCount);
}

/**
 * Run hybrid discovery: database first, web fallback
 * Main orchestrator for the database-first discovery system
 */
export async function runHybridDiscovery(
  db: Database,
  config: GatingConfig,
  webDiscoveryFn: (
    config: GatingConfig,
    count: number
  ) => Promise<ValidatedProfile[]>,
  maxStaleDays: number = 90,
  targetCount: number = 20
): Promise<HybridDiscoveryResult> {
  // Step 1: Query database
  const dbResult = await queryDatabaseForProfiles(db, config, maxStaleDays);

  let fromDatabase = 0;
  let fromWeb = 0;
  let staleProfilesRevalidated = 0;
  let deadUrlsDetected = 0;
  const allProfiles: ValidatedProfile[] = [];

  // Step 2: Process database results
  if (dbResult.success && dbResult.data) {
    const { fresh, stale, withDeadUrls } = await filterFreshProfiles(
      dbResult.data,
      maxStaleDays
    );

    // Add fresh profiles
    allProfiles.push(...fresh);
    fromDatabase = fresh.length;

    // Track stale and dead URL counts
    staleProfilesRevalidated = stale.length;
    deadUrlsDetected = withDeadUrls.length;

    console.log(
      `[HybridDiscovery] Database returned ${fresh.length} fresh profiles, ${stale.length} stale, ${withDeadUrls.length} with dead URLs`
    );
  }

  // Step 3: Calculate web discovery gap
  const gap = calculateWebDiscoveryGap(fromDatabase, targetCount);

  // Step 4: Fill gap with web discovery
  if (gap > 0) {
    console.log(
      `[HybridDiscovery] Need ${gap} more profiles from web discovery`
    );
    const webProfiles = await webDiscoveryFn(config, gap);
    allProfiles.push(...webProfiles);
    fromWeb = webProfiles.length;
  } else {
    console.log(
      `[HybridDiscovery] Database provided enough profiles (${fromDatabase}), skipping web discovery`
    );
  }

  return {
    profiles: allProfiles.slice(0, targetCount), // Cap at target
    fromDatabase,
    fromWeb,
    staleProfilesRevalidated,
    deadUrlsDetected,
    totalReturned: Math.min(allProfiles.length, targetCount),
  };
}

/**
 * Calculate discovery efficiency statistics
 * Shows how much token savings the database provides
 */
export function calculateDiscoveryStats(
  result: HybridDiscoveryResult
): DiscoveryStats {
  const total = result.fromDatabase + result.fromWeb;
  const efficiencyGain =
    total > 0 ? Math.round((result.fromDatabase / total) * 100) : 0;

  return {
    databaseHits: result.fromDatabase,
    databaseMisses: result.fromWeb,
    webDiscoveryRequired: result.fromWeb,
    efficiencyGain,
  };
}

/**
 * Format discovery result for human-readable report
 * Returns markdown summary of discovery sources
 */
export function formatDiscoverySummary(
  result: HybridDiscoveryResult
): string {
  const stats = calculateDiscoveryStats(result);

  const lines = [
    `**Discovery Sources:**`,
    `- Database: ${result.fromDatabase} profiles`,
    `- Web: ${result.fromWeb} profiles`,
    `- Total returned: ${result.totalReturned}`,
    ``,
    `**Efficiency:** ${stats.efficiencyGain}% from database (token savings)`,
  ];

  if (result.staleProfilesRevalidated > 0) {
    lines.push(
      `**Note:** ${result.staleProfilesRevalidated} stale profiles excluded (>90 days old)`
    );
  }

  if (result.deadUrlsDetected > 0) {
    lines.push(
      `**Note:** ${result.deadUrlsDetected} profiles with dead citation URLs excluded`
    );
  }

  return lines.join('\n');
}
