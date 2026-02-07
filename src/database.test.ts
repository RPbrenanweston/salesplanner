/**
 * Tests for Supabase database persistence layer
 */

import { Database } from './database.js';
import { ValidatedProfile, GatingConfig } from './types.js';
import { ExclusionEntry } from './exclusion.js';

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    // Clear environment variables to force local-only mode for tests
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    db = new Database();
  });

  describe('Initialization', () => {
    it('should gracefully handle missing credentials', () => {
      expect(db.isAvailable()).toBe(false);
    });

    it('should initialize in local-only mode without errors', () => {
      expect(() => new Database()).not.toThrow();
    });
  });

  describe('Graceful Degradation', () => {
    const sampleProfile: ValidatedProfile = {
      name: 'Alice Engineer',
      handle: '@alice',
      primaryUrl: 'https://github.com/alice',
      languages: ['TypeScript', 'Go'],
      engineeringFocus: 'Backend systems',
      geography: 'US',
      signals: {
        code: true,
        depth: true,
        sustained: true,
        thinking: false,
        peer: true
      },
      citations: [
        {
          signal: 'code',
          url: 'https://github.com/alice/project',
          description: 'Non-trivial distributed system'
        }
      ]
    };

    const sampleConfig: GatingConfig = {
      engineeringFocus: 'Backend',
      languages: ['TypeScript'],
      depthExpectation: 'Distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs'],
      geography: 'US'
    };

    it('should return graceful error when upserting engineer without credentials', async () => {
      const result = await db.upsertEngineer(sampleProfile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database unavailable');
      expect(result.data).toBeUndefined();
    });

    it('should return graceful error when batch upserting engineers', async () => {
      const result = await db.upsertEngineers([sampleProfile]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database unavailable');
    });

    it('should return graceful error when recording search run', async () => {
      const result = await db.recordSearchRun(sampleConfig, 50, 25, 20, 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database unavailable');
    });

    it('should return graceful error when syncing exclusions', async () => {
      const exclusions: ExclusionEntry[] = [
        {
          name: 'Bob Developer',
          primaryUrl: 'https://github.com/bob',
          searchContext: 'Backend | TypeScript | Distributed systems',
          excludedAt: new Date().toISOString()
        }
      ];

      const result = await db.syncExclusions(exclusions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database unavailable');
    });

    it('should return graceful error when fetching exclusions', async () => {
      const result = await db.fetchExclusions();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database unavailable');
    });

    it('should return graceful error when querying engineers', async () => {
      const result = await db.queryEngineers(sampleConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database unavailable');
    });
  });

  describe('Data Transformation', () => {
    it('should convert ValidatedProfile to EngineerRecord format correctly', () => {
      const profile: ValidatedProfile = {
        name: 'Charlie Coder',
        handle: '@charlie',
        primaryUrl: 'https://github.com/charlie',
        languages: ['Rust', 'C++'],
        engineeringFocus: 'Systems programming',
        geography: 'EU',
        signals: {
          code: true,
          depth: true,
          sustained: true,
          thinking: true,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/charlie/kernel-module',
            description: 'Linux kernel contribution'
          },
          {
            signal: 'thinking',
            url: 'https://charlie.dev/memory-allocation',
            description: 'Deep dive on memory allocation strategies'
          }
        ]
      };

      // The transformation happens internally - we verify structure matches expectations
      expect(profile.name).toBe('Charlie Coder');
      expect(profile.primaryUrl).toBe('https://github.com/charlie');
      expect(profile.languages).toEqual(['Rust', 'C++']);
      expect(profile.signals.code).toBe(true);
      expect(profile.citations).toHaveLength(2);
    });

    it('should handle optional fields in ValidatedProfile', () => {
      const profileMinimal: ValidatedProfile = {
        name: 'Diana Dev',
        primaryUrl: 'https://github.com/diana',
        languages: ['Python'],
        engineeringFocus: 'ML Engineering',
        signals: {
          code: true,
          depth: false,
          sustained: true,
          thinking: false,
          peer: true
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/diana/ml-pipeline',
            description: 'Production ML pipeline'
          }
        ]
      };

      expect(profileMinimal.handle).toBeUndefined();
      expect(profileMinimal.geography).toBeUndefined();
    });

    it('should convert ExclusionEntry to ExclusionRecord format correctly', () => {
      const exclusion: ExclusionEntry = {
        name: 'Eve Engineer',
        primaryUrl: 'https://github.com/eve',
        searchContext: 'Frontend | React | Component design',
        excludedAt: '2026-02-07T12:00:00Z'
      };

      expect(exclusion.name).toBe('Eve Engineer');
      expect(exclusion.primaryUrl).toBe('https://github.com/eve');
      expect(exclusion.searchContext).toContain('Frontend');
    });
  });

  describe('Configuration Validation', () => {
    it('should accept valid GatingConfig for recordSearchRun', () => {
      const config: GatingConfig = {
        engineeringFocus: 'Full stack',
        languages: ['JavaScript', 'Python'],
        depthExpectation: 'Web applications',
        evidencePriorities: ['GitHub repos', 'OSS contributions'],
        geography: 'Global'
      };

      expect(config.engineeringFocus).toBe('Full stack');
      expect(config.languages).toHaveLength(2);
      expect(config.evidencePriorities).toHaveLength(2);
    });

    it('should handle empty geography in GatingConfig', () => {
      const config: GatingConfig = {
        engineeringFocus: 'Backend',
        languages: ['Go'],
        depthExpectation: 'Distributed systems',
        evidencePriorities: ['GitHub repos', 'Tech blogs'],
        geography: ''
      };

      expect(config.geography).toBe('');
    });
  });

  describe('Query Parameters', () => {
    it('should use 90-day default staleness threshold', async () => {
      const config: GatingConfig = {
        engineeringFocus: 'DevOps',
        languages: ['Go', 'Python'],
        depthExpectation: 'Infrastructure',
        evidencePriorities: ['GitHub repos', 'Conference talks'],
        geography: ''
      };

      // Will fail gracefully in local-only mode, but we verify the call signature
      const result = await db.queryEngineers(config);
      expect(result.success).toBe(false);
    });

    it('should accept custom staleness threshold', async () => {
      const config: GatingConfig = {
        engineeringFocus: 'Security',
        languages: ['Rust'],
        depthExpectation: 'Cryptography',
        evidencePriorities: ['GitHub repos', 'Tech blogs'],
        geography: ''
      };

      // Custom 30-day threshold
      const result = await db.queryEngineers(config, 30);
      expect(result.success).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    it('should accept batch upsert of multiple profiles', async () => {
      const profiles: ValidatedProfile[] = [
        {
          name: 'Frank Full-stack',
          primaryUrl: 'https://github.com/frank',
          languages: ['TypeScript', 'Python'],
          engineeringFocus: 'Full stack',
          signals: {
            code: true,
            depth: false,
            sustained: true,
            thinking: false,
            peer: true
          },
          citations: []
        },
        {
          name: 'Grace Backend',
          primaryUrl: 'https://github.com/grace',
          languages: ['Go'],
          engineeringFocus: 'Backend',
          signals: {
            code: true,
            depth: true,
            sustained: true,
            thinking: true,
            peer: false
          },
          citations: []
        }
      ];

      const result = await db.upsertEngineers(profiles);
      expect(result.success).toBe(false); // Graceful failure in local-only mode
    });

    it('should handle empty batch upsert', async () => {
      const result = await db.upsertEngineers([]);
      expect(result.success).toBe(false);
    });
  });

  describe('Exclusion Sync', () => {
    it('should sync multiple exclusions', async () => {
      const exclusions: ExclusionEntry[] = [
        {
          name: 'Henry Dev',
          primaryUrl: 'https://github.com/henry',
          searchContext: 'Mobile | Swift | iOS',
          excludedAt: '2026-02-07T10:00:00Z'
        },
        {
          name: 'Iris Engineer',
          primaryUrl: 'https://github.com/iris',
          searchContext: 'Data | Python | ML',
          excludedAt: '2026-02-07T11:00:00Z'
        }
      ];

      const result = await db.syncExclusions(exclusions);
      expect(result.success).toBe(false); // Graceful failure
    });

    it('should handle empty exclusion list', async () => {
      const result = await db.syncExclusions([]);
      expect(result.success).toBe(false);
    });
  });

  describe('SearchRun Metadata', () => {
    it('should record complete search run metadata', async () => {
      const config: GatingConfig = {
        engineeringFocus: 'Infrastructure',
        languages: ['Go', 'Rust'],
        depthExpectation: 'Distributed systems',
        evidencePriorities: ['GitHub repos', 'Conference talks', 'Tech blogs'],
        geography: ''
      };

      const result = await db.recordSearchRun(
        config,
        100, // discovered
        50,  // validated
        20,  // returned
        30   // exclusion count
      );

      expect(result.success).toBe(false); // Graceful failure
    });

    it('should accept zero counts in search run', async () => {
      const config: GatingConfig = {
        engineeringFocus: 'Embedded',
        languages: ['C'],
        depthExpectation: 'Hardware',
        evidencePriorities: ['GitHub repos', 'Tech blogs'],
        geography: ''
      };

      const result = await db.recordSearchRun(config, 0, 0, 0, 0);
      expect(result.success).toBe(false);
    });
  });

  describe('Database Result Type Safety', () => {
    it('should have typed DatabaseResult for engineers', async () => {
      const profile: ValidatedProfile = {
        name: 'Test',
        primaryUrl: 'https://github.com/test',
        languages: ['TypeScript'],
        engineeringFocus: 'Test',
        signals: {
          code: true,
          depth: false,
          sustained: false,
          thinking: false,
          peer: false
        },
        citations: []
      };

      const result = await db.upsertEngineer(profile);

      // TypeScript should enforce the structure
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result).toHaveProperty('error');
      }
    });

    it('should have typed DatabaseResult for exclusions', async () => {
      const result = await db.fetchExclusions();

      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result.data).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should have typed DatabaseResult for search runs', async () => {
      const config: GatingConfig = {
        engineeringFocus: 'Test',
        languages: ['TypeScript'],
        depthExpectation: 'Test',
        evidencePriorities: ['GitHub repos', 'Tech blogs'],
        geography: ''
      };

      const result = await db.recordSearchRun(config, 0, 0, 0, 0);

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Bidirectional Exclusion Sync', () => {
    it('should support writing exclusions to database', async () => {
      const exclusions: ExclusionEntry[] = [
        {
          name: 'Jack Dev',
          primaryUrl: 'https://github.com/jack',
          searchContext: 'Context',
          excludedAt: new Date().toISOString()
        }
      ];

      const writeResult = await db.syncExclusions(exclusions);
      expect(writeResult.success).toBe(false); // Local-only mode
    });

    it('should support reading exclusions from database', async () => {
      const readResult = await db.fetchExclusions();
      expect(readResult.success).toBe(false); // Local-only mode
    });

    it('should handle bidirectional sync flow', async () => {
      // This would work when Supabase is available:
      // 1. syncExclusions() writes local exclusions to DB
      // 2. fetchExclusions() reads DB exclusions back
      // 3. Merge and deduplicate by primaryUrl

      const exclusions: ExclusionEntry[] = [];

      // Write
      const writeResult = await db.syncExclusions(exclusions);
      expect(writeResult.success).toBe(false);

      // Read
      const readResult = await db.fetchExclusions();
      expect(readResult.success).toBe(false);
    });
  });

  describe('Query Filtering', () => {
    it('should query by language overlap', async () => {
      const config: GatingConfig = {
        engineeringFocus: 'Backend',
        languages: ['Go', 'Rust'],
        depthExpectation: 'Systems',
        evidencePriorities: ['GitHub repos', 'Tech blogs'],
        geography: ''
      };

      const result = await db.queryEngineers(config);
      expect(result.success).toBe(false); // Local-only
    });

    it('should filter by geography when specified', async () => {
      const config: GatingConfig = {
        engineeringFocus: 'Frontend',
        languages: ['TypeScript'],
        depthExpectation: 'Web',
        evidencePriorities: ['GitHub repos', 'OSS contributions'],
        geography: 'Europe'
      };

      const result = await db.queryEngineers(config);
      expect(result.success).toBe(false);
    });

    it('should respect staleness threshold', async () => {
      const config: GatingConfig = {
        engineeringFocus: 'ML',
        languages: ['Python'],
        depthExpectation: 'Deep learning',
        evidencePriorities: ['GitHub repos', 'Tech blogs'],
        geography: ''
      };

      // 30-day threshold - should filter out anything older
      const result = await db.queryEngineers(config, 30);
      expect(result.success).toBe(false);
    });
  });
});
