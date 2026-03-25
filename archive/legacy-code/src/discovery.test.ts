import { describe, expect, test } from '@jest/globals';
import type { GatingConfig } from './types.js';
import {
  buildSearchQueries,
  discoverFromGitHub,
  discoverFromBlogs,
  discoverFromConferences,
  discoverCandidates,
  validateCandidateEvidence,
  type DiscoveredCandidate,
} from './discovery.js';

// Sample config for testing
const sampleConfig: GatingConfig = {
  engineeringFocus: 'distributed systems',
  languages: ['Go', 'Rust'],
  depthExpectation: 'production-scale expertise',
  evidencePriorities: ['GitHub repos', 'Tech blogs', 'Conference talks'],
  geography: 'US/Europe',
};

describe('Discovery Engine', () => {
  describe('buildSearchQueries', () => {
    test('generates GitHub queries for each language', () => {
      const queries = buildSearchQueries(sampleConfig);

      expect(queries.github).toContain(
        'Go distributed systems site:github.com'
      );
      expect(queries.github).toContain(
        'Rust distributed systems site:github.com'
      );
      expect(queries.github).toHaveLength(2); // One per language
    });

    test('generates blog queries with depth focus', () => {
      const queries = buildSearchQueries(sampleConfig);

      expect(queries.blogs.length).toBeGreaterThan(0);
      expect(queries.blogs[0]).toContain('distributed systems');
      expect(queries.blogs[0]).toContain('production-scale expertise');
    });

    test('generates conference queries when priority selected', () => {
      const queries = buildSearchQueries(sampleConfig);

      expect(queries.conferences.length).toBeGreaterThan(0);
      expect(queries.conferences[0]).toContain('distributed systems');
      expect(queries.conferences[0]).toContain('conference');
    });

    test('omits conference queries when not in evidence priorities', () => {
      const configNoConferences: GatingConfig = {
        ...sampleConfig,
        evidencePriorities: ['GitHub repos', 'Tech blogs'],
      };

      const queries = buildSearchQueries(configNoConferences);

      expect(queries.conferences).toHaveLength(0);
    });

    test('derives all queries from config values only', () => {
      const customConfig: GatingConfig = {
        engineeringFocus: 'frontend performance',
        languages: ['TypeScript'],
        depthExpectation: 'advanced',
        evidencePriorities: ['GitHub repos'],
        geography: 'global',
      };

      const queries = buildSearchQueries(customConfig);

      expect(queries.github[0]).toContain('TypeScript');
      expect(queries.github[0]).toContain('frontend performance');
      expect(queries.github[0]).not.toContain('Go');
      expect(queries.github[0]).not.toContain('distributed systems');
    });
  });

  describe('discoverFromGitHub', () => {
    test('discovers candidates from GitHub repo URLs', () => {
      const urls = [
        'https://github.com/alice/awesome-go-project',
        'https://github.com/bob/rust-distributed-db',
      ];

      const candidates = discoverFromGitHub(sampleConfig, urls);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].handle).toBe('alice');
      expect(candidates[1].handle).toBe('bob');
    });

    test('each candidate has at least one source URL', () => {
      const urls = ['https://github.com/alice/project'];

      const candidates = discoverFromGitHub(sampleConfig, urls);

      expect(candidates[0].evidenceUrls.length).toBeGreaterThan(0);
      expect(candidates[0].primaryUrl).toBe(urls[0]);
    });

    test('sets discovery method to github', () => {
      const urls = ['https://github.com/alice/project'];

      const candidates = discoverFromGitHub(sampleConfig, urls);

      expect(candidates[0].discoveryMethod).toBe('github');
    });

    test('skips invalid GitHub URLs', () => {
      const urls = [
        'https://github.com/alice/project',
        'https://not-github.com/something',
        'invalid-url',
      ];

      const candidates = discoverFromGitHub(sampleConfig, urls);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].handle).toBe('alice');
    });

    test('respects source registry constraints', () => {
      const urls = [
        'https://github.com/alice/project',
        'https://linkedin.com/in/bob', // Disallowed source
      ];

      const candidates = discoverFromGitHub(sampleConfig, urls);

      // LinkedIn should be filtered out by source validation
      expect(candidates).toHaveLength(1);
      expect(candidates[0].primaryUrl).toContain('github.com');
    });
  });

  describe('discoverFromBlogs', () => {
    test('discovers candidates from blog URLs', () => {
      const urls = [
        'https://alice.dev/distributed-systems-guide',
        'https://medium.com/@bob/scaling-rust-services',
      ];

      const candidates = discoverFromBlogs(sampleConfig, urls);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].discoveryMethod).toBe('blog');
    });

    test('attaches evidence URLs to candidates', () => {
      const urls = ['https://alice.dev/article'];

      const candidates = discoverFromBlogs(sampleConfig, urls);

      expect(candidates[0].evidenceUrls).toContain(urls[0]);
      expect(candidates[0].primaryUrl).toBe(urls[0]);
    });

    test('respects source registry validation', () => {
      const urls = [
        'https://alice.dev/article',
        'https://linkedin.com/pulse/article', // Disallowed
      ];

      const candidates = discoverFromBlogs(sampleConfig, urls);

      expect(candidates.length).toBeLessThan(urls.length);
    });
  });

  describe('discoverFromConferences', () => {
    test('discovers candidates from conference talk URLs', () => {
      const urls = [
        'https://youtube.com/watch?v=conference-talk',
        'https://confreaks.tv/videos/rubyconf-talk',
      ];

      const candidates = discoverFromConferences(sampleConfig, urls);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].discoveryMethod).toBe('conference');
    });

    test('stores conference URLs as evidence', () => {
      const urls = ['https://youtube.com/watch?v=talk'];

      const candidates = discoverFromConferences(sampleConfig, urls);

      expect(candidates[0].evidenceUrls).toContain(urls[0]);
    });
  });

  describe('discoverCandidates (orchestrator)', () => {
    test('aggregates candidates from all sources', () => {
      const githubUrls = ['https://github.com/alice/project'];
      const blogUrls = ['https://alice.dev/article'];
      const conferenceUrls = ['https://youtube.com/watch?v=talk'];

      const result = discoverCandidates(
        sampleConfig,
        githubUrls,
        blogUrls,
        conferenceUrls
      );

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.totalFound).toBeGreaterThanOrEqual(result.approvedCount);
    });

    test('filters candidates through source registry', () => {
      const githubUrls = ['https://github.com/alice/project'];
      const blogUrls = ['https://linkedin.com/pulse/article']; // Disallowed - filtered by discoverFromBlogs
      const conferenceUrls: string[] = [];

      const result = discoverCandidates(
        sampleConfig,
        githubUrls,
        blogUrls,
        conferenceUrls
      );

      // LinkedIn blog should be filtered out early by discoverFromBlogs,
      // so it never reaches the aggregator
      // We should only see the GitHub candidate
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].primaryUrl).toContain('github.com');
    });

    test('returns metadata about filtering', () => {
      const githubUrls = ['https://github.com/alice/project'];
      const blogUrls = ['https://alice.dev/article'];
      const conferenceUrls: string[] = [];

      const result = discoverCandidates(
        sampleConfig,
        githubUrls,
        blogUrls,
        conferenceUrls
      );

      expect(result.totalFound).toBeDefined();
      expect(result.approvedCount).toBeDefined();
      expect(result.rejectedCount).toBeDefined();
      expect(result.rejectedUrls).toBeDefined();
    });

    test('ensures every approved candidate has evidence URLs', () => {
      const githubUrls = ['https://github.com/alice/project'];
      const blogUrls = ['https://alice.dev/article'];
      const conferenceUrls: string[] = [];

      const result = discoverCandidates(
        sampleConfig,
        githubUrls,
        blogUrls,
        conferenceUrls
      );

      result.candidates.forEach((candidate) => {
        expect(candidate.evidenceUrls.length).toBeGreaterThan(0);
        expect(candidate.primaryUrl).toBeTruthy();
      });
    });
  });

  describe('validateCandidateEvidence', () => {
    test('passes when candidate has evidence URLs', () => {
      const candidate: DiscoveredCandidate = {
        name: 'Alice',
        handle: 'alice',
        primaryUrl: 'https://github.com/alice/project',
        evidenceUrls: ['https://github.com/alice/project'],
        discoveryMethod: 'github',
      };

      expect(validateCandidateEvidence(candidate)).toBe(true);
    });

    test('fails when candidate has no evidence URLs', () => {
      const candidate: DiscoveredCandidate = {
        name: 'Bob',
        primaryUrl: 'https://example.com',
        evidenceUrls: [],
        discoveryMethod: 'other',
      };

      expect(validateCandidateEvidence(candidate)).toBe(false);
    });

    test('fails when primaryUrl not in evidenceUrls', () => {
      const candidate: DiscoveredCandidate = {
        name: 'Charlie',
        primaryUrl: 'https://example.com/primary',
        evidenceUrls: ['https://example.com/different'],
        discoveryMethod: 'other',
      };

      expect(validateCandidateEvidence(candidate)).toBe(false);
    });

    test('fails when primaryUrl is empty', () => {
      const candidate: DiscoveredCandidate = {
        name: 'Dave',
        primaryUrl: '',
        evidenceUrls: ['https://example.com'],
        discoveryMethod: 'other',
      };

      expect(validateCandidateEvidence(candidate)).toBe(false);
    });
  });
});
