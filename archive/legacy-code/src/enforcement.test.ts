import {
  checkCitationCoverage,
  checkSeniorityInference,
  checkSkillSummarization,
  checkContradictions,
  enforceHallucinationControl,
  filterEnforcedProfiles,
} from './enforcement';
import { ValidatedProfile, Citation } from './types';

describe('Hallucination Control Enforcement', () => {
  describe('checkCitationCoverage', () => {
    it('should pass when factual claims have citations', () => {
      const text = 'Built distributed system (https://github.com/user/repo). Wrote performance blog post (https://blog.example.com/perf).';
      const citations: Citation[] = [];
      const violations = checkCitationCoverage(text, citations, 'test-user');

      expect(violations).toHaveLength(0);
    });

    it('should fail when factual claim lacks citation', () => {
      const text = 'Built distributed system. Improved performance.';
      const citations: Citation[] = [];
      const violations = checkCitationCoverage(text, citations, 'test-user');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rule).toBe('citation_required');
      expect(violations[0].severity).toBe('error');
    });

    it('should detect uncited "created" claims', () => {
      const text = 'Created a new microservice architecture.';
      const citations: Citation[] = [];
      const violations = checkCitationCoverage(text, citations, 'test-user');

      expect(violations).toHaveLength(1);
      expect(violations[0].offendingStatement).toContain('Created a new microservice');
    });

    it('should detect uncited "contributed to" claims', () => {
      const text = 'Contributed to major OSS projects.';
      const citations: Citation[] = [];
      const violations = checkCitationCoverage(text, citations, 'test-user');

      expect(violations).toHaveLength(1);
      expect(violations[0].offendingStatement).toContain('Contributed to major OSS');
    });

    it('should detect uncited employment claims', () => {
      const text = 'Works at TechCorp as a backend engineer.';
      const citations: Citation[] = [];
      const violations = checkCitationCoverage(text, citations, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should allow markdown link citations', () => {
      const text = 'Built distributed system [repo](https://github.com/user/repo).';
      const citations: Citation[] = [];
      const violations = checkCitationCoverage(text, citations, 'test-user');

      expect(violations).toHaveLength(0);
    });

    it('should skip non-factual statements', () => {
      const text = 'Note: This profile was validated on 2026-02-07.';
      const citations: Citation[] = [];
      const violations = checkCitationCoverage(text, citations, 'test-user');

      expect(violations).toHaveLength(0);
    });
  });

  describe('checkSeniorityInference', () => {
    it('should pass when seniority is cited from artefacts', () => {
      const text = 'Architected distributed systems (https://github.com/user/repo).';
      const violations = checkSeniorityInference(text, 'test-user');

      expect(violations).toHaveLength(0);
    });

    it('should fail when seniority inferred from years', () => {
      const text = '10+ years of experience makes them a senior engineer.';
      const violations = checkSeniorityInference(text, 'test-user');

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('seniority_inference');
      expect(violations[0].severity).toBe('error');
    });

    it('should detect "senior based on years" pattern', () => {
      const text = 'Senior engineer based on 8 years of contributions.';
      const violations = checkSeniorityInference(text, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should detect "veteran developer" claims', () => {
      const text = 'Veteran developer with deep expertise.';
      const violations = checkSeniorityInference(text, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should detect "long-time contributor" claims', () => {
      const text = 'Long-time contributor to the Rust ecosystem.';
      const violations = checkSeniorityInference(text, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should allow seniority from artefacts not time', () => {
      const text = 'Designed core architecture visible in RFC (https://example.com/rfc).';
      const violations = checkSeniorityInference(text, 'test-user');

      expect(violations).toHaveLength(0);
    });
  });

  describe('checkSkillSummarization', () => {
    it('should pass when skills have artefact citations', () => {
      const text = 'Proficient in Rust (https://github.com/user/rust-project).';
      const violations = checkSkillSummarization(text, 'test-user');

      expect(violations).toHaveLength(0);
    });

    it('should fail when skills lack artefacts', () => {
      const text = 'Proficient in Go, Rust, and Python.';
      const violations = checkSkillSummarization(text, 'test-user');

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('skill_without_artefact');
      expect(violations[0].severity).toBe('error');
    });

    it('should detect "skilled in" without citation', () => {
      const text = 'Skilled in distributed systems.';
      const violations = checkSkillSummarization(text, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should detect "experienced with" without citation', () => {
      const text = 'Experienced with Kubernetes and Docker.';
      const violations = checkSkillSummarization(text, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should detect "specializes in" without citation', () => {
      const text = 'Specializes in performance optimization.';
      const violations = checkSkillSummarization(text, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should detect "expertise in" without citation', () => {
      const text = 'Expertise in backend architecture.';
      const violations = checkSkillSummarization(text, 'test-user');

      expect(violations).toHaveLength(1);
    });
  });

  describe('checkContradictions', () => {
    it('should pass when citations are consistent', () => {
      const citations: Citation[] = [
        { signal: 'code', url: 'https://github.com/user/repo1', description: 'Uses Go for services' },
        { signal: 'code', url: 'https://github.com/user/repo2', description: 'Uses Go for CLI tools' },
      ];
      const violations = checkContradictions(citations, 'test-user');

      expect(violations).toHaveLength(0);
    });

    it('should fail when citations contradict', () => {
      const citations: Citation[] = [
        { signal: 'code', url: 'https://github.com/user/repo1', description: 'Uses TypeScript' },
        { signal: 'code', url: 'https://github.com/user/repo2', description: 'Does not use TypeScript' },
      ];
      const violations = checkContradictions(citations, 'test-user');

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('contradictory_sources');
      expect(violations[0].severity).toBe('error');
    });

    it('should detect supports vs does not support contradiction', () => {
      const citations: Citation[] = [
        { signal: 'depth', url: 'https://blog.example.com/post1', description: 'Supports distributed tracing' },
        { signal: 'depth', url: 'https://blog.example.com/post2', description: 'Does not support distributed tracing' },
      ];
      const violations = checkContradictions(citations, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should detect includes vs excludes contradiction', () => {
      const citations: Citation[] = [
        { signal: 'thinking', url: 'https://blog.example.com/post1', description: 'Includes authentication layer' },
        { signal: 'thinking', url: 'https://blog.example.com/post2', description: 'Excludes authentication layer' },
      ];
      const violations = checkContradictions(citations, 'test-user');

      expect(violations).toHaveLength(1);
    });

    it('should not flag different signals as contradictions', () => {
      const citations: Citation[] = [
        { signal: 'code', url: 'https://github.com/user/repo', description: 'Uses Rust' },
        { signal: 'thinking', url: 'https://blog.example.com/post', description: 'Uses Go in examples' },
      ];
      const violations = checkContradictions(citations, 'test-user');

      expect(violations).toHaveLength(0);
    });
  });

  describe('enforceHallucinationControl', () => {
    const createProfile = (
      name: string,
      citations: Citation[]
    ): ValidatedProfile => ({
      name,
      handle: name.toLowerCase(),
      primaryUrl: `https://github.com/${name.toLowerCase()}`,
      languages: ['Go'],
      engineeringFocus: 'Backend',
      geography: 'US',
      signals: {
        code: true,
        depth: true,
        sustained: true,
        thinking: false,
        peer: false,
      },
      citations,
      discoverySource: {
        method: 'github',
        query: 'test',
        discoveredAt: new Date(),
      },
    });

    it('should pass when all profiles have proper citations', () => {
      const profile = createProfile(
        'GoodDev',
        [
          { signal: 'code', url: 'https://github.com/gooddev/repo', description: 'Built distributed system' },
        ]
      );

      const result = enforceHallucinationControl([profile], (_p) =>
        `Built distributed system (${profile.citations[0].url}).`
      );

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.profilesProcessed).toBe(1);
      expect(result.profilesRejected).toBe(0);
    });

    it('should fail when profile has uncited claims', () => {
      const profile = createProfile(
        'BadDev',
        []
      );

      const result = enforceHallucinationControl([profile], () =>
        'Built distributed system without citation.'
      );

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.profilesRejected).toBe(1);
    });

    it('should flag multiple violations across profiles', () => {
      const profile1 = createProfile('Dev1', []);
      const profile2 = createProfile('Dev2', []);

      const result = enforceHallucinationControl([profile1, profile2], (p) => {
        if (p.name === 'Dev1') return 'Built system.';
        return 'Created app. Improved performance.';
      });

      expect(result.violations.length).toBeGreaterThan(2);
      expect(result.profilesRejected).toBe(2);
    });

    it('should collect violations by type', () => {
      const profile = createProfile(
        'MixedViolations',
        []
      );

      const result = enforceHallucinationControl([profile], () =>
        'Senior engineer with 10 years. Proficient in Go.'
      );

      const ruleTypes = new Set(result.violations.map(v => v.rule));
      expect(ruleTypes.has('seniority_inference')).toBe(true);
      expect(ruleTypes.has('skill_without_artefact')).toBe(true);
    });
  });

  describe('filterEnforcedProfiles', () => {
    const createProfile = (name: string): ValidatedProfile => ({
      name,
      handle: name.toLowerCase(),
      primaryUrl: `https://github.com/${name.toLowerCase()}`,
      languages: ['Go'],
      engineeringFocus: 'Backend',
      geography: 'US',
      signals: {
        code: true,
        depth: true,
        sustained: true,
        thinking: false,
        peer: false,
      },
      citations: [],
      discoverySource: {
        method: 'github',
        query: 'test',
        discoveredAt: new Date(),
      },
    });

    it('should return all profiles when enforcement passes', () => {
      const profiles = [createProfile('Dev1'), createProfile('Dev2')];
      const result = {
        passed: true,
        violations: [],
        profilesProcessed: 2,
        profilesRejected: 0,
      };

      const filtered = filterEnforcedProfiles(profiles, result);
      expect(filtered).toHaveLength(2);
    });

    it('should filter out profiles with violations', () => {
      const profiles = [createProfile('GoodDev'), createProfile('BadDev')];
      const result = {
        passed: false,
        violations: [
          {
            rule: 'citation_required',
            severity: 'error' as const,
            offendingStatement: 'Built system.',
            profileIdentifier: 'BadDev',
          },
        ],
        profilesProcessed: 2,
        profilesRejected: 1,
      };

      const filtered = filterEnforcedProfiles(profiles, result);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('GoodDev');
    });

    it('should keep profiles with only warnings', () => {
      const profiles = [createProfile('Dev1')];
      const result = {
        passed: false,
        violations: [
          {
            rule: 'minor_issue',
            severity: 'warning' as const,
            offendingStatement: 'Something minor.',
            profileIdentifier: 'Dev1',
          },
        ],
        profilesProcessed: 1,
        profilesRejected: 0,
      };

      const filtered = filterEnforcedProfiles(profiles, result);
      expect(filtered).toHaveLength(1);
    });

    it('should handle multiple violations for same profile', () => {
      const profiles = [createProfile('MultiViolation')];
      const result = {
        passed: false,
        violations: [
          {
            rule: 'citation_required',
            severity: 'error' as const,
            offendingStatement: 'Built system.',
            profileIdentifier: 'MultiViolation',
          },
          {
            rule: 'seniority_inference',
            severity: 'error' as const,
            offendingStatement: 'Senior with 10 years.',
            profileIdentifier: 'MultiViolation',
          },
        ],
        profilesProcessed: 1,
        profilesRejected: 1,
      };

      const filtered = filterEnforcedProfiles(profiles, result);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('End-to-end enforcement scenario', () => {
    it('should enforce all rules on realistic profile text', () => {
      const profile: ValidatedProfile = {
        name: 'Realistic Dev',
        handle: 'realisticdev',
        primaryUrl: 'https://github.com/realisticdev',
        languages: ['Go', 'Rust'],
        engineeringFocus: 'Distributed Systems',
        geography: 'US',
        signals: {
          code: true,
          depth: true,
          sustained: true,
          thinking: true,
          peer: true,
        },
        citations: [
          {
            signal: 'code',
            url: 'https://github.com/realisticdev/distributed-cache',
            description: 'Built distributed caching system in Go',
          },
          {
            signal: 'depth',
            url: 'https://blog.realisticdev.com/consistency',
            description: 'Wrote about eventual consistency patterns',
          },
        ],
        discoverySource: {
          method: 'github',
          query: 'distributed systems Go',
          discoveredAt: new Date(),
        },
      };

      const goodText = `Built distributed caching system (https://github.com/realisticdev/distributed-cache). Wrote about eventual consistency patterns (https://blog.realisticdev.com/consistency).`;

      const badText = `Senior engineer with 12 years of experience. Proficient in Go and Rust. Built many distributed systems. Expert in performance optimization.`;

      // Good text should pass
      const goodResult = enforceHallucinationControl([profile], () => goodText);
      expect(goodResult.passed).toBe(true);

      // Bad text should fail with multiple violations
      const badResult = enforceHallucinationControl([profile], () => badText);
      expect(badResult.passed).toBe(false);
      expect(badResult.violations.length).toBeGreaterThan(0);

      // Should have seniority inference violation
      const seniorityViolations = badResult.violations.filter(
        v => v.rule === 'seniority_inference'
      );
      expect(seniorityViolations.length).toBeGreaterThan(0);

      // Should have skill summarization violations
      const skillViolations = badResult.violations.filter(
        v => v.rule === 'skill_without_artefact'
      );
      expect(skillViolations.length).toBeGreaterThan(0);

      // Should have uncited claim violations
      const citationViolations = badResult.violations.filter(
        v => v.rule === 'citation_required'
      );
      expect(citationViolations.length).toBeGreaterThan(0);
    });
  });
});
