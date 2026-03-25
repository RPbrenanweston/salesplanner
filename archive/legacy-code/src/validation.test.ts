import { describe, it, expect } from '@jest/globals';
import {
  evaluateCodeSignal,
  evaluateDepthSignal,
  evaluateSustainedSignal,
  evaluateThinkingSignal,
  evaluatePeerSignal,
  validateCandidate,
  validateCandidates,
  filterIncludedProfiles,
  toValidatedProfile,
} from './validation.js';
import { DiscoveredCandidate } from './discovery.js';
import { GatingConfig } from './types.js';

// Test fixtures
const mockConfig: GatingConfig = {
  engineeringFocus: 'Backend',
  languages: ['TypeScript', 'Go'],
  depthExpectation: 'Distributed systems',
  evidencePriorities: ['GitHub repos', 'Tech blogs'],
  geography: 'United States',
};

const candidateWithAllSignals: DiscoveredCandidate = {
  name: 'Alice Engineer',
  primaryUrl: 'https://github.com/alice',
  evidenceUrls: [
    'https://github.com/alice',
    'https://github.com/alice/distributed-cache',
    'https://github.com/kubernetes/kubernetes/pull/12345',
    'https://medium.com/@alice/building-distributed-systems',
    'https://www.youtube.com/watch?v=xyz123',
    'https://stackoverflow.com/users/123456/alice',
  ],
  discoveryMethod: 'github',
  languages: ['TypeScript', 'Go'],
  focus: 'Backend',
};

const candidateWithCodeOnly: DiscoveredCandidate = {
  name: 'Bob Coder',
  primaryUrl: 'https://github.com/bob/simple-app',
  evidenceUrls: ['https://github.com/bob/simple-app'],
  discoveryMethod: 'github',
  languages: ['TypeScript'],
  focus: 'Backend',
};

const candidateWithNoSignals: DiscoveredCandidate = {
  name: 'Charlie Unknown',
  primaryUrl: 'https://example.com/charlie',
  evidenceUrls: ['https://example.com/charlie'],
  discoveryMethod: 'other',
  languages: ['TypeScript'],
  focus: 'Backend',
};

const candidateWithThreeSignals: DiscoveredCandidate = {
  name: 'Diana Developer',
  primaryUrl: 'https://github.com/diana',
  evidenceUrls: [
    'https://github.com/diana',
    'https://github.com/diana/project-one',
    'https://github.com/diana/project-two',
    'https://medium.com/@diana/technical-post',
    'https://stackoverflow.com/users/789012/diana',
  ],
  discoveryMethod: 'github',
  languages: ['TypeScript', 'Go'],
  focus: 'Backend',
};

describe('Five-Signal Validation Framework', () => {
  describe('Code Signal', () => {
    it('should detect GitHub repositories', () => {
      const result = evaluateCodeSignal(candidateWithAllSignals);
      expect(result.signal).toBe('code');
      expect(result.present).toBe(true);
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations.some(c => c.url.includes('github.com'))).toBe(true);
    });

    it('should detect pull requests', () => {
      const result = evaluateCodeSignal(candidateWithAllSignals);
      const prCitation = result.citations.find(c => c.url.includes('/pull/'));
      expect(prCitation).toBeDefined();
      expect(prCitation?.description).toContain('Pull request');
    });

    it('should return absent when no code evidence', () => {
      const result = evaluateCodeSignal(candidateWithNoSignals);
      expect(result.present).toBe(false);
      expect(result.citations.length).toBe(0);
    });

    it('should include citation URL for each code artefact', () => {
      const result = evaluateCodeSignal(candidateWithAllSignals);
      for (const citation of result.citations) {
        expect(citation.url).toBeTruthy();
        expect(citation.url.startsWith('http')).toBe(true);
        expect(citation.description).toBeTruthy();
      }
    });
  });

  describe('Depth Signal', () => {
    it('should detect conference talks', () => {
      const result = evaluateDepthSignal(candidateWithAllSignals, mockConfig);
      expect(result.present).toBe(true);
      const talkCitation = result.citations.find(c => c.url.includes('youtube.com'));
      expect(talkCitation).toBeDefined();
      expect(talkCitation?.description).toContain('Conference talk');
    });

    it('should return absent when no depth evidence', () => {
      const result = evaluateDepthSignal(candidateWithCodeOnly, mockConfig);
      expect(result.present).toBe(false);
    });

    it('should not infer depth from job titles', () => {
      const candidateWithTitle: DiscoveredCandidate = {
        name: 'Senior Principal Architect',
        primaryUrl: 'https://example.com/architect',
        evidenceUrls: ['https://example.com/architect'],
        discoveryMethod: 'other',
        languages: ['TypeScript'],
        focus: 'Backend',
      };
      const result = evaluateDepthSignal(candidateWithTitle, mockConfig);
      expect(result.present).toBe(false);
    });

    it('should include citation URL for depth evidence', () => {
      const result = evaluateDepthSignal(candidateWithAllSignals, mockConfig);
      expect(result.citations.length).toBeGreaterThan(0);
      for (const citation of result.citations) {
        expect(citation.url).toBeTruthy();
        expect(citation.signal).toBe('depth');
      }
    });
  });

  describe('Sustained Signal', () => {
    it('should detect GitHub profile for activity history', () => {
      const result = evaluateSustainedSignal(candidateWithAllSignals);
      expect(result.present).toBe(true);
      const profileCitation = result.citations.find(c => c.description.includes('activity history'));
      expect(profileCitation).toBeDefined();
    });

    it('should detect multiple artefacts as sustained indicator', () => {
      const result = evaluateSustainedSignal(candidateWithThreeSignals);
      expect(result.present).toBe(true);
      expect(result.citations.length).toBeGreaterThan(0);
    });

    it('should return absent for single artefact', () => {
      const result = evaluateSustainedSignal(candidateWithCodeOnly);
      expect(result.present).toBe(false);
    });

    it('should include citation URL for sustained evidence', () => {
      const result = evaluateSustainedSignal(candidateWithAllSignals);
      for (const citation of result.citations) {
        expect(citation.url).toBeTruthy();
        expect(citation.signal).toBe('sustained');
      }
    });
  });

  describe('Thinking Signal', () => {
    it('should detect technical blog posts', () => {
      const result = evaluateThinkingSignal(candidateWithAllSignals);
      expect(result.present).toBe(true);
      const blogCitation = result.citations.find(c => c.url.includes('medium.com'));
      expect(blogCitation).toBeDefined();
      expect(blogCitation?.description).toContain('writing');
    });

    it('should detect conference talks as thinking evidence', () => {
      const result = evaluateThinkingSignal(candidateWithAllSignals);
      const talkCitation = result.citations.find(c => c.url.includes('youtube.com'));
      expect(talkCitation).toBeDefined();
    });

    it('should return absent when no thinking evidence', () => {
      const result = evaluateThinkingSignal(candidateWithCodeOnly);
      expect(result.present).toBe(false);
    });

    it('should include citation URL for thinking evidence', () => {
      const result = evaluateThinkingSignal(candidateWithAllSignals);
      expect(result.citations.length).toBeGreaterThan(0);
      for (const citation of result.citations) {
        expect(citation.url).toBeTruthy();
        expect(citation.signal).toBe('thinking');
      }
    });
  });

  describe('Peer Signal', () => {
    it('should detect merged pull requests', () => {
      const result = evaluatePeerSignal(candidateWithAllSignals);
      expect(result.present).toBe(true);
      const prCitation = result.citations.find(c => c.url.includes('/pull/'));
      expect(prCitation).toBeDefined();
      expect(prCitation?.description).toContain('Merged pull request');
    });

    it('should detect Stack Overflow profiles', () => {
      const result = evaluatePeerSignal(candidateWithAllSignals);
      const soCitation = result.citations.find(c => c.url.includes('stackoverflow.com'));
      expect(soCitation).toBeDefined();
    });

    it('should return absent when no peer evidence', () => {
      const result = evaluatePeerSignal(candidateWithCodeOnly);
      expect(result.present).toBe(false);
    });

    it('should include citation URL for peer evidence', () => {
      const result = evaluatePeerSignal(candidateWithAllSignals);
      expect(result.citations.length).toBeGreaterThan(0);
      for (const citation of result.citations) {
        expect(citation.url).toBeTruthy();
        expect(citation.signal).toBe('peer');
      }
    });
  });

  describe('Complete Validation', () => {
    it('should include profile when 3+ signals present', () => {
      const result = validateCandidate(candidateWithThreeSignals, mockConfig);
      expect(result.included).toBe(true);
      expect(result.signalCount).toBeGreaterThanOrEqual(3);
      expect(result.reason).toContain('signals present');
    });

    it('should exclude profile when fewer than 3 signals', () => {
      const result = validateCandidate(candidateWithCodeOnly, mockConfig);
      expect(result.included).toBe(false);
      expect(result.signalCount).toBeLessThan(3);
      expect(result.reason).toContain('minimum: 3 required');
    });

    it('should include all 5 signals when all present', () => {
      const result = validateCandidate(candidateWithAllSignals, mockConfig);
      expect(result.signals.length).toBe(5);
      expect(result.signalCount).toBe(5);
      expect(result.included).toBe(true);
    });

    it('should return binary signal results (present or absent)', () => {
      const result = validateCandidate(candidateWithAllSignals, mockConfig);
      for (const signal of result.signals) {
        expect(typeof signal.present).toBe('boolean');
        if (signal.present) {
          expect(signal.citations.length).toBeGreaterThan(0);
        } else {
          expect(signal.citations.length).toBe(0);
        }
      }
    });

    it('should never use job titles as evidence', () => {
      const candidateWithTitles: DiscoveredCandidate = {
        name: 'Senior Staff Engineer',
        primaryUrl: 'https://example.com/senior-staff',
        evidenceUrls: ['https://example.com/senior-staff'],
        discoveryMethod: 'other',
        languages: ['TypeScript'],
        focus: 'Backend',
      };
      const result = validateCandidate(candidateWithTitles, mockConfig);
      expect(result.signalCount).toBe(0);
    });

    it('should store citations with signal name, URL, and description', () => {
      const result = validateCandidate(candidateWithAllSignals, mockConfig);
      for (const signal of result.signals) {
        for (const citation of signal.citations) {
          expect(citation.signal).toBeTruthy();
          expect(citation.url).toBeTruthy();
          expect(citation.url.startsWith('http')).toBe(true);
          expect(citation.description).toBeTruthy();
        }
      }
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple candidates', () => {
      const candidates = [
        candidateWithAllSignals,
        candidateWithThreeSignals,
        candidateWithCodeOnly,
        candidateWithNoSignals,
      ];
      const results = validateCandidates(candidates, mockConfig);
      expect(results.length).toBe(4);
      expect(results.every(r => r.signals.length === 5)).toBe(true);
    });

    it('should filter to only included profiles', () => {
      const candidates = [
        candidateWithAllSignals,
        candidateWithThreeSignals,
        candidateWithCodeOnly,
        candidateWithNoSignals,
      ];
      const results = validateCandidates(candidates, mockConfig);
      const included = filterIncludedProfiles(results);
      expect(included.length).toBeGreaterThan(0);
      expect(included.length).toBeLessThan(candidates.length);
      for (const profile of included) {
        expect(profile.citations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Profile Conversion', () => {
    it('should convert validation result to validated profile', () => {
      const validation = validateCandidate(candidateWithAllSignals, mockConfig);
      const profile = toValidatedProfile(validation);
      expect(profile.name).toBe(candidateWithAllSignals.name);
      expect(profile.primaryUrl).toBe(candidateWithAllSignals.primaryUrl);
      expect(profile.languages).toEqual(candidateWithAllSignals.languages);
      expect(profile.signals).toBeDefined();
      expect(profile.citations.length).toBeGreaterThan(0);
    });

    it('should throw error when converting excluded candidate', () => {
      const validation = validateCandidate(candidateWithCodeOnly, mockConfig);
      expect(() => toValidatedProfile(validation)).toThrow('Cannot convert excluded candidate');
    });

    it('should preserve all signal states in profile', () => {
      const validation = validateCandidate(candidateWithAllSignals, mockConfig);
      const profile = toValidatedProfile(validation);
      expect(Object.keys(profile.signals)).toEqual(['code', 'depth', 'sustained', 'thinking', 'peer']);
      for (const [, present] of Object.entries(profile.signals)) {
        expect(typeof present).toBe('boolean');
      }
    });

    it('should include all citations from all signals', () => {
      const validation = validateCandidate(candidateWithAllSignals, mockConfig);
      const profile = toValidatedProfile(validation);
      const totalCitations = validation.signals.reduce((sum, s) => sum + s.citations.length, 0);
      expect(profile.citations.length).toBe(totalCitations);
    });
  });
});
