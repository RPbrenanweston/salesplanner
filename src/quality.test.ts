/**
 * Tests for Quality Hardening Layer
 *
 * Validates all four quality passes and their logging behavior.
 */

import { describe, it, expect } from '@jest/globals';
import {
  evidenceStrictnessPass,
  signalQualityPass,
  languageAlignmentPass,
  reportClarityPass,
  runQualityHardening,
  generateQualityReport
} from './quality.js';
import { ValidatedProfile, GatingConfig } from './types.js';

// Test fixtures
const createValidProfile = (overrides?: Partial<ValidatedProfile>): ValidatedProfile => ({
  name: 'Test Engineer',
  handle: 'testeng',
  primaryUrl: 'https://github.com/testeng',
  languages: ['TypeScript', 'Go'],
  engineeringFocus: 'Backend Systems',
  signals: {
    code: true,
    depth: true,
    sustained: true,
    thinking: false,
    peer: false
  },
  citations: [
    {
      signal: 'code',
      url: 'https://github.com/testeng/repo1',
      description: 'Implemented distributed caching system with Redis clustering'
    },
    {
      signal: 'code',
      url: 'https://github.com/testeng/repo2',
      description: 'Built API gateway with rate limiting and circuit breakers'
    },
    {
      signal: 'depth',
      url: 'https://github.com/testeng/pr-123',
      description: 'Performance optimization reducing query latency by 60%'
    },
    {
      signal: 'sustained',
      url: 'https://github.com/testeng',
      description: 'Active contributions spanning 18 months across multiple projects'
    }
  ],
  ...overrides
});

const createTestConfig = (overrides?: Partial<GatingConfig>): GatingConfig => ({
  engineeringFocus: 'Backend Systems',
  languages: ['TypeScript', 'Go', 'Rust'],
  depthExpectation: 'Distributed systems and performance optimization',
  evidencePriorities: ['GitHub repos', 'Tech blogs'],
  geography: '',
  ...overrides
});

describe('Quality Hardening Layer', () => {
  describe('evidenceStrictnessPass', () => {
    it('should pass profiles with valid citations', () => {
      const profiles = [createValidProfile()];
      const result = evidenceStrictnessPass(profiles);

      expect(result.profilesRemoved).toBe(0);
      expect(result.log).toHaveLength(0);
    });

    it('should remove profiles with invalid citation URLs', () => {
      const profile = createValidProfile({
        citations: [
          {
            signal: 'code',
            url: 'not-a-url',
            description: 'Invalid citation'
          }
        ]
      });

      const result = evidenceStrictnessPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('invalid citation'));
    });

    it('should remove profiles with insufficient citation density', () => {
      const profile = createValidProfile({
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
            url: 'https://github.com/test',
            description: 'Only one citation for 4 signals'
          }
        ]
      });

      const result = evidenceStrictnessPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('Insufficient citations'));
    });

    it('should accept profiles with citation count >= signal count', () => {
      const profile = createValidProfile({
        signals: {
          code: true,
          depth: true,
          sustained: false,
          thinking: false,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo1',
            description: 'First code contribution'
          },
          {
            signal: 'depth',
            url: 'https://github.com/test/repo2',
            description: 'Systems work'
          }
        ]
      });

      const result = evidenceStrictnessPass([profile]);

      expect(result.profilesRemoved).toBe(0);
    });
  });

  describe('signalQualityPass', () => {
    it('should pass profiles with high-quality code signal', () => {
      const profiles = [createValidProfile()];
      const result = signalQualityPass(profiles);

      expect(result.profilesRemoved).toBe(0);
      expect(result.log).toHaveLength(0);
    });

    it('should remove profiles with only one code citation', () => {
      const profile = createValidProfile({
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test',
            description: 'Single substantial commit'
          },
          {
            signal: 'depth',
            url: 'https://github.com/test/pr',
            description: 'Performance work'
          },
          {
            signal: 'sustained',
            url: 'https://github.com/test',
            description: 'Activity over time'
          }
        ]
      });

      const result = signalQualityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('Code signal too shallow'));
    });

    it('should remove profiles with only trivial commits', () => {
      const profile = createValidProfile({
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/commit1',
            description: 'Fix typo in README'
          },
          {
            signal: 'code',
            url: 'https://github.com/test/commit2',
            description: 'Bump version number'
          },
          {
            signal: 'sustained',
            url: 'https://github.com/test',
            description: 'Activity over time'
          }
        ]
      });

      const result = signalQualityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('only trivial contributions'));
    });

    it('should remove profiles with depth signal lacking systems work', () => {
      const profile = createValidProfile({
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo1',
            description: 'Built user authentication module'
          },
          {
            signal: 'code',
            url: 'https://github.com/test/repo2',
            description: 'Created admin dashboard'
          },
          {
            signal: 'depth',
            url: 'https://github.com/test/pr',
            description: 'Added new API endpoint'
          }
        ]
      });

      const result = signalQualityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('lacks systems-level evidence'));
    });

    it('should pass profiles with valid depth signal keywords', () => {
      const profile = createValidProfile({
        signals: {
          code: true,
          depth: true,
          sustained: false,
          thinking: false,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo1',
            description: 'Built service'
          },
          {
            signal: 'code',
            url: 'https://github.com/test/repo2',
            description: 'Added feature'
          },
          {
            signal: 'depth',
            url: 'https://github.com/test/pr',
            description: 'Optimized database query performance reducing latency'
          }
        ]
      });

      const result = signalQualityPass([profile]);

      expect(result.profilesRemoved).toBe(0);
    });

    it('should remove profiles with shallow thinking signal', () => {
      const profile = createValidProfile({
        signals: {
          code: true,
          depth: false,
          sustained: false,
          thinking: true,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo1',
            description: 'Built feature'
          },
          {
            signal: 'code',
            url: 'https://github.com/test/repo2',
            description: 'Added functionality'
          },
          {
            signal: 'thinking',
            url: 'https://stackoverflow.com/a/12345',
            description: 'Short answer on Stack Overflow'
          }
        ]
      });

      const result = signalQualityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('lacks substantive long-form content'));
    });

    it('should pass profiles with substantive thinking content', () => {
      const profile = createValidProfile({
        signals: {
          code: true,
          depth: false,
          sustained: false,
          thinking: true,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo1',
            description: 'Built feature'
          },
          {
            signal: 'code',
            url: 'https://github.com/test/repo2',
            description: 'Added functionality'
          },
          {
            signal: 'thinking',
            url: 'https://medium.com/@test/article',
            description: 'Technical blog post on distributed consensus algorithms'
          }
        ]
      });

      const result = signalQualityPass([profile]);

      expect(result.profilesRemoved).toBe(0);
    });

    it('should remove profiles with weak peer signal', () => {
      const profile = createValidProfile({
        signals: {
          code: true,
          depth: false,
          sustained: false,
          thinking: false,
          peer: true
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo1',
            description: 'Built feature'
          },
          {
            signal: 'code',
            url: 'https://github.com/test/repo2',
            description: 'Added functionality'
          },
          {
            signal: 'peer',
            url: 'https://github.com/org/repo/pr/123',
            description: 'Single accepted PR'
          }
        ]
      });

      const result = signalQualityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('Peer signal too weak'));
    });
  });

  describe('languageAlignmentPass', () => {
    it('should pass profiles with matching languages', () => {
      const profiles = [createValidProfile()];
      const config = createTestConfig();
      const result = languageAlignmentPass(profiles, config);

      expect(result.profilesRemoved).toBe(0);
      expect(result.log).toHaveLength(0);
    });

    it('should remove profiles with no language overlap', () => {
      const profile = createValidProfile({
        languages: ['Python', 'Java']
      });
      const config = createTestConfig({
        languages: ['TypeScript', 'Go', 'Rust']
      });

      const result = languageAlignmentPass([profile], config);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('No overlap with target languages'));
    });

    it('should handle partial language name matches', () => {
      const profile = createValidProfile({
        languages: ['TypeScript']
      });
      const config = createTestConfig({
        languages: ['Type'] // Partial match on prefix
      });

      const result = languageAlignmentPass([profile], config);

      expect(result.profilesRemoved).toBe(0);
    });

    it('should remove profiles with engineering focus misalignment', () => {
      const profile = createValidProfile({
        engineeringFocus: 'Frontend Development',
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo1',
            description: 'Built React components'
          },
          {
            signal: 'code',
            url: 'https://github.com/test/repo2',
            description: 'CSS animations'
          }
        ]
      });
      const config = createTestConfig({
        engineeringFocus: 'Backend Systems'
      });

      const result = languageAlignmentPass([profile], config);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('Engineering focus misalignment'));
    });

    it('should allow general and full stack focuses', () => {
      const profile = createValidProfile({
        engineeringFocus: 'Frontend Development'
      });
      const config = createTestConfig({
        engineeringFocus: 'Full Stack'
      });

      const result = languageAlignmentPass([profile], config);

      expect(result.profilesRemoved).toBe(0);
    });

    it('should check citation text for focus alignment', () => {
      const profile = createValidProfile({
        engineeringFocus: 'Application Development',
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo1',
            description: 'Backend API with distributed caching'
          },
          {
            signal: 'code',
            url: 'https://github.com/test/repo2',
            description: 'Systems-level optimization'
          }
        ]
      });
      const config = createTestConfig({
        engineeringFocus: 'Backend Systems'
      });

      const result = languageAlignmentPass([profile], config);

      expect(result.profilesRemoved).toBe(0); // Should pass due to citation alignment
    });
  });

  describe('reportClarityPass', () => {
    it('should pass profiles with complete required fields', () => {
      const profiles = [createValidProfile()];
      const result = reportClarityPass(profiles);

      expect(result.profilesRemoved).toBe(0);
      expect(result.log).toHaveLength(0);
    });

    it('should remove profiles with missing name', () => {
      const profile = createValidProfile({ name: '' });
      const result = reportClarityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('Missing name'));
    });

    it('should remove profiles with invalid primary URL', () => {
      const profile = createValidProfile({ primaryUrl: 'not-a-url' });
      const result = reportClarityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('Invalid or missing primary URL'));
    });

    it('should remove profiles with no languages', () => {
      const profile = createValidProfile({ languages: [] });
      const result = reportClarityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('No languages specified'));
    });

    it('should remove profiles with missing engineering focus', () => {
      const profile = createValidProfile({ engineeringFocus: '' });
      const result = reportClarityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('Missing engineering focus'));
    });

    it('should remove profiles with non-descriptive citations', () => {
      const profile = createValidProfile({
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test',
            description: 'code' // Too short
          }
        ]
      });
      const result = reportClarityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('lack descriptive content'));
    });

    it('should remove profiles with signal-citation misalignment', () => {
      const profile = createValidProfile({
        signals: {
          code: true,
          depth: true,
          sustained: false,
          thinking: false,
          peer: false
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/test/repo',
            description: 'Code contribution with substance'
          }
          // Missing citation for 'depth' signal
        ]
      });

      const result = reportClarityPass([profile]);

      expect(result.profilesRemoved).toBe(1);
      expect(result.log).toContainEqual(expect.stringContaining('Signal \'depth\' marked present but no citations'));
    });
  });

  describe('runQualityHardening', () => {
    it('should run all passes in sequence', () => {
      const profiles = [createValidProfile()];
      const config = createTestConfig();

      const { profiles: filtered, result } = runQualityHardening(profiles, config);

      expect(result.passes).toHaveLength(4);
      expect(result.passes[0].passName).toBe('Evidence Strictness');
      expect(result.passes[1].passName).toBe('Signal Quality');
      expect(result.passes[2].passName).toBe('Language & Scope Alignment');
      expect(result.passes[3].passName).toBe('Report Clarity');
      expect(filtered).toHaveLength(1);
    });

    it('should cascade filtering through all passes', () => {
      const profiles = [
        createValidProfile({ name: 'Valid' }),
        createValidProfile({
          name: 'Invalid - Bad Citation',
          citations: [{
            signal: 'code',
            url: 'bad-url',
            description: 'Invalid'
          }]
        }),
        createValidProfile({
          name: 'Invalid - Shallow Code',
          citations: [{
            signal: 'code',
            url: 'https://github.com/test',
            description: 'Only one code citation'
          }]
        }),
        createValidProfile({
          name: 'Invalid - Language Mismatch',
          languages: ['Python'],
          citations: [
            {
              signal: 'code',
              url: 'https://github.com/test/repo1',
              description: 'Code work'
            },
            {
              signal: 'code',
              url: 'https://github.com/test/repo2',
              description: 'More code'
            }
          ]
        })
      ];

      const config = createTestConfig({ languages: ['TypeScript', 'Go'] });
      const { profiles: filtered, result } = runQualityHardening(profiles, config);

      expect(result.totalRemoved).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThan(profiles.length);
    });

    it('should track removal counts correctly', () => {
      const profiles = [
        createValidProfile({ name: 'Valid' }),
        createValidProfile({
          name: 'Invalid',
          primaryUrl: 'bad-url'
        })
      ];

      const config = createTestConfig();
      const { result } = runQualityHardening(profiles, config);

      expect(result.finalProfileCount).toBe(1);
      expect(result.totalRemoved).toBe(1);
    });
  });

  describe('generateQualityReport', () => {
    it('should generate readable quality report', () => {
      const profiles = [createValidProfile()];
      const config = createTestConfig();

      const { result } = runQualityHardening(profiles, config);
      const report = generateQualityReport(result);

      expect(report).toContain('# Quality Hardening Report');
      expect(report).toContain('Pass 1: Evidence Strictness');
      expect(report).toContain('Pass 2: Signal Quality');
      expect(report).toContain('Pass 3: Language & Scope Alignment');
      expect(report).toContain('Pass 4: Report Clarity');
    });

    it('should include detailed logs when removals occur', () => {
      const profiles = [
        createValidProfile({ name: 'Invalid', primaryUrl: 'bad-url' })
      ];
      const config = createTestConfig();

      const { result } = runQualityHardening(profiles, config);
      const report = generateQualityReport(result);

      expect(report).toContain('Details');
      expect(report).toContain('Invalid');
    });
  });
});
