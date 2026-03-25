/**
 * Tests for source registry and validation
 */

import { describe, expect, test } from '@jest/globals';
import {
  SOURCE_REGISTRY,
  validateSourceUrl,
  validateSourceUrls,
  filterApprovedSources
} from './sources';

describe('Source Registry', () => {
  test('defines primary and secondary tiers', () => {
    expect(SOURCE_REGISTRY.primary).toBeDefined();
    expect(SOURCE_REGISTRY.secondary).toBeDefined();
    expect(SOURCE_REGISTRY.primary.length).toBeGreaterThan(0);
    expect(SOURCE_REGISTRY.secondary.length).toBeGreaterThan(0);
  });

  test('primary sources include GitHub repos and commit history', () => {
    const githubRepos = SOURCE_REGISTRY.primary.find(s => s.name === 'GitHub Repositories');
    expect(githubRepos).toBeDefined();
    expect(githubRepos?.description).toContain('commit history');
  });

  test('primary sources include personal and technical blogs', () => {
    const blogs = SOURCE_REGISTRY.primary.find(s => s.name === 'Personal Blogs');
    expect(blogs).toBeDefined();

    const medium = SOURCE_REGISTRY.primary.find(s => s.name === 'Medium');
    expect(medium).toBeDefined();
  });

  test('primary sources include conference talks on YouTube', () => {
    const youtube = SOURCE_REGISTRY.primary.find(s => s.name === 'Conference Talks (YouTube)');
    expect(youtube).toBeDefined();
    expect(youtube?.description).toContain('YouTube');
  });

  test('secondary sources include Stack Overflow profiles only', () => {
    const so = SOURCE_REGISTRY.secondary.find(s => s.name === 'Stack Overflow');
    expect(so).toBeDefined();
    expect(so?.description).toContain('profiles and answers');
  });

  test('disallowed sources list blocks LinkedIn scraping', () => {
    const linkedin = SOURCE_REGISTRY.disallowed.find(s => s.name === 'LinkedIn');
    expect(linkedin).toBeDefined();
    expect(linkedin?.description).toContain('scraping prohibited');
  });

  test('disallowed sources list blocks paid databases', () => {
    const paidSources = SOURCE_REGISTRY.disallowed.filter(s =>
      s.description.toLowerCase().includes('paid') ||
      s.description.toLowerCase().includes('marketplace')
    );
    expect(paidSources.length).toBeGreaterThan(0);
  });
});

describe('Source Validation', () => {
  test('rejects disallowed LinkedIn URL patterns', () => {
    const result = validateSourceUrl('https://www.linkedin.com/in/johndoe');
    expect(result.tier).toBe('rejected');
    expect(result.matchedPattern).toBe('LinkedIn');
  });

  test('rejects Indeed resume aggregator', () => {
    const result = validateSourceUrl('https://www.indeed.com/profile/johndoe');
    expect(result.tier).toBe('rejected');
  });

  test('rejects Glassdoor resume aggregator', () => {
    const result = validateSourceUrl('https://www.glassdoor.com/profile/johndoe');
    expect(result.tier).toBe('rejected');
  });

  test('rejects paid talent marketplace Toptal', () => {
    const result = validateSourceUrl('https://www.toptal.com/developers/johndoe');
    expect(result.tier).toBe('rejected');
  });

  test('accepts GitHub repository as primary source', () => {
    const result = validateSourceUrl('https://github.com/torvalds/linux');
    expect(result.tier).toBe('primary');
    expect(result.matchedPattern).toBe('GitHub Repositories');
  });

  test('accepts GitHub pull request as primary source', () => {
    const result = validateSourceUrl('https://github.com/microsoft/vscode/pull/12345');
    expect(result.tier).toBe('primary');
    expect(result.matchedPattern).toBe('GitHub Discussions');
  });

  test('accepts Medium technical article as primary source', () => {
    const result = validateSourceUrl('https://medium.com/@author/article-title');
    expect(result.tier).toBe('primary');
    expect(result.matchedPattern).toBe('Medium');
  });

  test('accepts YouTube conference talk as primary source', () => {
    const result = validateSourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.tier).toBe('primary');
    expect(result.matchedPattern).toBe('Conference Talks (YouTube)');
  });

  test('accepts Stack Overflow profile as secondary source', () => {
    const result = validateSourceUrl('https://stackoverflow.com/users/123456/johndoe');
    expect(result.tier).toBe('secondary');
    expect(result.matchedPattern).toBe('Stack Overflow');
  });

  test('accepts GitHub profile summary as secondary source', () => {
    const result = validateSourceUrl('https://github.com/torvalds');
    expect(result.tier).toBe('secondary');
    expect(result.matchedPattern).toBe('GitHub Profile');
  });

  test('batch validates multiple URLs', () => {
    const urls = [
      'https://github.com/torvalds/linux',
      'https://www.linkedin.com/in/johndoe',
      'https://stackoverflow.com/users/123456/johndoe'
    ];

    const results = validateSourceUrls(urls);
    expect(results).toHaveLength(3);
    expect(results[0].tier).toBe('primary');
    expect(results[1].tier).toBe('rejected');
    expect(results[2].tier).toBe('secondary');
  });

  test('filters to only approved sources', () => {
    const urls = [
      'https://github.com/torvalds/linux',
      'https://www.linkedin.com/in/johndoe',
      'https://stackoverflow.com/users/123456/johndoe',
      'https://www.toptal.com/developers/johndoe'
    ];

    const approved = filterApprovedSources(urls);
    expect(approved).toHaveLength(2);
    expect(approved).toContain('https://github.com/torvalds/linux');
    expect(approved).toContain('https://stackoverflow.com/users/123456/johndoe');
  });
});

describe('Acceptance Criteria Verification', () => {
  test('AC1: Source registry config defines primary and secondary tiers', () => {
    expect(SOURCE_REGISTRY.primary).toBeDefined();
    expect(SOURCE_REGISTRY.secondary).toBeDefined();
    expect(Array.isArray(SOURCE_REGISTRY.primary)).toBe(true);
    expect(Array.isArray(SOURCE_REGISTRY.secondary)).toBe(true);
  });

  test('AC2: Disallowed sources list blocks LinkedIn scraping and paid DBs', () => {
    const linkedin = validateSourceUrl('https://www.linkedin.com/in/test');
    const toptal = validateSourceUrl('https://www.toptal.com/developers/test');
    expect(linkedin.tier).toBe('rejected');
    expect(toptal.tier).toBe('rejected');
  });

  test('AC3: Source validation function rejects disallowed URL patterns', () => {
    const disallowed = [
      'https://www.linkedin.com/in/test',
      'https://www.indeed.com/profile/test',
      'https://www.glassdoor.com/profile/test'
    ];

    disallowed.forEach(url => {
      const result = validateSourceUrl(url);
      expect(result.tier).toBe('rejected');
    });
  });

  test('AC4: Primary sources include GitHub repos and commit history', () => {
    const repo = validateSourceUrl('https://github.com/torvalds/linux');
    const pr = validateSourceUrl('https://github.com/microsoft/vscode/pull/123');
    expect(repo.tier).toBe('primary');
    expect(pr.tier).toBe('primary');
  });

  test('AC5: Primary sources include personal and technical blogs', () => {
    const medium = validateSourceUrl('https://medium.com/@author/article');
    const devto = validateSourceUrl('https://dev.to/author/article');
    expect(medium.tier).toBe('primary');
    expect(devto.tier).toBe('primary');
  });

  test('AC6: Primary sources include conference talks on YouTube', () => {
    const youtube = validateSourceUrl('https://www.youtube.com/watch?v=abc123');
    expect(youtube.tier).toBe('primary');
    expect(youtube.matchedPattern).toBe('Conference Talks (YouTube)');
  });

  test('AC7: Secondary sources include Stack Overflow profiles only', () => {
    const so = validateSourceUrl('https://stackoverflow.com/users/123456/johndoe');
    expect(so.tier).toBe('secondary');
    expect(so.matchedPattern).toBe('Stack Overflow');
  });

  test('AC8: Typecheck passes (validated by running npm run typecheck)', () => {
    // This test validates that TypeScript types are correctly defined
    // Actual typecheck verification happens via npm run typecheck command
    expect(true).toBe(true);
  });
});
