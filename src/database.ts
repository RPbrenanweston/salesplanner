/**
 * @crumb
 * @id database-persistence
 * @area DAT
 * @intent Persist validated profiles to Supabase; provide graceful fallback when DB unavailable (local-only mode)
 * @responsibilities Supabase initialization, upsert operations, batch queries, exclusion syncing, profile lookup
 * @contracts initialize() → void; isAvailable() → bool; upsertEngineer(profile: ValidatedProfile) → Promise<DatabaseResult<void>>; upsertEngineers(profiles: ValidatedProfile[]) → Promise<DatabaseResult<void>>; recordSearchRun(config, counts) → Promise<DatabaseResult<void>>; queryEngineers(config, maxStaleDays) → Promise<DatabaseResult<ValidatedProfile[]>>; getDatabaseStats(maxStaleDays) → Promise<DatabaseResult<stats>>
 * @in env vars: SUPABASE_URL, SUPABASE_ANON_KEY (optional fallback to local JSON)
 * @out upserted records (snake_case), search run logs, exclusion list
 * @err SupabaseError, missing env vars, partial batch failures (silent)
 * @hazard Batch upsert() silently ignores partial failures — no rollback mechanism, silent data loss
 * @hazard Upsert key hardcoded to primary_url — email conflicts possible on duplicate emails with different URLs
 * @shared-edges hybrid-discovery.ts→CALLS queryEngineers(), validation.ts→CALLS upsertEngineers(), enforcement.ts→CALLS getDatabaseStats()
 * @prompt When adding new query methods, wrap in transaction to prevent partial failures. Audit upsert key strategy for multi-tenant (email dedup needed?).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ValidatedProfile, GatingConfig, SignalName } from './types.js';
import { ExclusionEntry } from './exclusion.js';

/**
 * Database record for engineers table
 */
export interface EngineerRecord {
  id?: string;
  name: string;
  handle?: string;
  primary_url: string;
  languages: string[];
  engineering_focus: string;
  geography?: string;
  signals: Record<SignalName, boolean>;
  citations: Array<{
    signal: SignalName;
    url: string;
    description: string;
  }>;
  last_validated: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Database record for search runs
 */
export interface SearchRunRecord {
  id?: string;
  config: GatingConfig;
  profiles_discovered: number;
  profiles_validated: number;
  profiles_returned: number;
  exclusion_count: number;
  created_at?: string;
}

/**
 * Database record for exclusions
 */
export interface ExclusionRecord {
  id?: string;
  engineer_id?: string;
  name: string;
  primary_url: string;
  search_context: string;
  excluded_at: string;
}

/**
 * Result of a database operation
 */
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Supabase database client wrapper
 */
export class Database {
  private client: SupabaseClient | null = null;
  private available: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Supabase client from environment variables
   */
  private initialize(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Database] Supabase credentials not found in environment. Running in local-only mode.');
      this.available = false;
      return;
    }

    try {
      this.client = createClient(supabaseUrl, supabaseKey);
      this.available = true;
      console.log('[Database] Supabase client initialized successfully.');
    } catch (error) {
      console.error('[Database] Failed to initialize Supabase client:', error);
      this.available = false;
    }
  }

  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Upsert validated profile to engineers table
   */
  async upsertEngineer(profile: ValidatedProfile): Promise<DatabaseResult<EngineerRecord>> {
    if (!this.available || !this.client) {
      return {
        success: false,
        error: 'Database unavailable - running in local-only mode'
      };
    }

    try {
      const record: EngineerRecord = {
        name: profile.name,
        handle: profile.handle,
        primary_url: profile.primaryUrl,
        languages: profile.languages,
        engineering_focus: profile.engineeringFocus,
        geography: profile.geography,
        signals: profile.signals,
        citations: profile.citations,
        last_validated: new Date().toISOString(),
      };

      const { data, error } = await this.client
        .from('engineers')
        .upsert(record, { onConflict: 'primary_url' })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: `Failed to upsert engineer: ${error.message}`
        };
      }

      return {
        success: true,
        data: data as EngineerRecord
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error upserting engineer: ${error}`
      };
    }
  }

  /**
   * Upsert multiple engineers in batch
   */
  async upsertEngineers(profiles: ValidatedProfile[]): Promise<DatabaseResult<EngineerRecord[]>> {
    if (!this.available || !this.client) {
      return {
        success: false,
        error: 'Database unavailable - running in local-only mode'
      };
    }

    try {
      const records: EngineerRecord[] = profiles.map(profile => ({
        name: profile.name,
        handle: profile.handle,
        primary_url: profile.primaryUrl,
        languages: profile.languages,
        engineering_focus: profile.engineeringFocus,
        geography: profile.geography,
        signals: profile.signals,
        citations: profile.citations,
        last_validated: new Date().toISOString(),
      }));

      const { data, error } = await this.client
        .from('engineers')
        .upsert(records, { onConflict: 'primary_url' })
        .select();

      if (error) {
        return {
          success: false,
          error: `Failed to batch upsert engineers: ${error.message}`
        };
      }

      return {
        success: true,
        data: data as EngineerRecord[]
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error batch upserting engineers: ${error}`
      };
    }
  }

  /**
   * Record a search run with metadata
   */
  async recordSearchRun(
    config: GatingConfig,
    profilesDiscovered: number,
    profilesValidated: number,
    profilesReturned: number,
    exclusionCount: number
  ): Promise<DatabaseResult<SearchRunRecord>> {
    if (!this.available || !this.client) {
      return {
        success: false,
        error: 'Database unavailable - running in local-only mode'
      };
    }

    try {
      const record: SearchRunRecord = {
        config,
        profiles_discovered: profilesDiscovered,
        profiles_validated: profilesValidated,
        profiles_returned: profilesReturned,
        exclusion_count: exclusionCount,
      };

      const { data, error } = await this.client
        .from('search_runs')
        .insert(record)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: `Failed to record search run: ${error.message}`
        };
      }

      return {
        success: true,
        data: data as SearchRunRecord
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error recording search run: ${error}`
      };
    }
  }

  /**
   * Sync exclusion list to database
   */
  async syncExclusions(exclusions: ExclusionEntry[]): Promise<DatabaseResult<ExclusionRecord[]>> {
    if (!this.available || !this.client) {
      return {
        success: false,
        error: 'Database unavailable - running in local-only mode'
      };
    }

    try {
      // Convert exclusion entries to database records
      const records: ExclusionRecord[] = exclusions.map(entry => ({
        name: entry.name,
        primary_url: entry.primaryUrl,
        search_context: entry.searchContext,
        excluded_at: entry.excludedAt,
      }));

      // Upsert exclusions (deduplicating by primary_url)
      const { data, error } = await this.client
        .from('exclusions')
        .upsert(records, { onConflict: 'primary_url' })
        .select();

      if (error) {
        return {
          success: false,
          error: `Failed to sync exclusions: ${error.message}`
        };
      }

      return {
        success: true,
        data: data as ExclusionRecord[]
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error syncing exclusions: ${error}`
      };
    }
  }

  /**
   * Fetch exclusions from database
   */
  async fetchExclusions(): Promise<DatabaseResult<ExclusionEntry[]>> {
    if (!this.available || !this.client) {
      return {
        success: false,
        error: 'Database unavailable - running in local-only mode'
      };
    }

    try {
      const { data, error } = await this.client
        .from('exclusions')
        .select('*')
        .order('excluded_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: `Failed to fetch exclusions: ${error.message}`
        };
      }

      // Convert database records to exclusion entries
      const exclusions: ExclusionEntry[] = (data as ExclusionRecord[]).map(record => ({
        name: record.name,
        primaryUrl: record.primary_url,
        searchContext: record.search_context,
        excludedAt: record.excluded_at,
      }));

      return {
        success: true,
        data: exclusions
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error fetching exclusions: ${error}`
      };
    }
  }

  /**
   * Query engineers matching current search criteria
   * Returns profiles validated within the last 90 days
   */
  async queryEngineers(
    config: GatingConfig,
    maxStaleDays: number = 90
  ): Promise<DatabaseResult<ValidatedProfile[]>> {
    if (!this.available || !this.client) {
      return {
        success: false,
        error: 'Database unavailable - running in local-only mode'
      };
    }

    try {
      const staleThreshold = new Date();
      staleThreshold.setDate(staleThreshold.getDate() - maxStaleDays);

      // Query by language overlap and focus match
      let query = this.client
        .from('engineers')
        .select('*')
        .gte('last_validated', staleThreshold.toISOString())
        .contains('languages', config.languages);

      // Add geography filter if specified
      if (config.geography) {
        query = query.ilike('geography', `%${config.geography}%`);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: `Failed to query engineers: ${error.message}`
        };
      }

      // Convert database records to validated profiles
      const profiles: ValidatedProfile[] = (data as EngineerRecord[]).map(record => ({
        name: record.name,
        handle: record.handle,
        primaryUrl: record.primary_url,
        languages: record.languages,
        engineeringFocus: record.engineering_focus,
        geography: record.geography,
        signals: record.signals,
        citations: record.citations,
      }));

      return {
        success: true,
        data: profiles
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error querying engineers: ${error}`
      };
    }
  }

  /**
   * Get database statistics for status reporting
   * Returns aggregated counts by language, focus, and staleness
   */
  async getDatabaseStats(maxStaleDays: number = 90): Promise<DatabaseResult<{
    totalEngineers: number;
    byLanguage: Record<string, number>;
    byFocus: Record<string, number>;
    fresh: number;
    stale: number;
  }>> {
    if (!this.available || !this.client) {
      return {
        success: false,
        error: 'Database unavailable - running in local-only mode'
      };
    }

    try {
      const { data: engineers, error } = await this.client
        .from('engineers')
        .select('languages, engineering_focus, last_validated');

      if (error) {
        return {
          success: false,
          error: `Failed to get database stats: ${error.message}`
        };
      }

      // Aggregate stats
      const byLanguage: Record<string, number> = {};
      const byFocus: Record<string, number> = {};
      let fresh = 0;
      let stale = 0;

      const staleThreshold = new Date();
      staleThreshold.setDate(staleThreshold.getDate() - maxStaleDays);

      engineers?.forEach((e: { languages: string[]; engineering_focus: string; last_validated: string }) => {
        // Count by language
        e.languages.forEach(lang => {
          byLanguage[lang] = (byLanguage[lang] || 0) + 1;
        });

        // Count by focus
        byFocus[e.engineering_focus] = (byFocus[e.engineering_focus] || 0) + 1;

        // Staleness check
        const lastValidated = new Date(e.last_validated);
        if (lastValidated >= staleThreshold) {
          fresh++;
        } else {
          stale++;
        }
      });

      return {
        success: true,
        data: {
          totalEngineers: engineers?.length || 0,
          byLanguage,
          byFocus,
          fresh,
          stale
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error getting database stats: ${error}`
      };
    }
  }
}

/**
 * Create a singleton database instance
 */
export function createDatabase(): Database {
  return new Database();
}
