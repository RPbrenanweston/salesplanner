/**
 * Tests for exclusion system
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import {
  loadExclusions,
  saveExclusions,
  addToExclusions,
  removeFromExclusions,
  filterExcludedProfiles,
  getExclusionCount,
  parseFeedback,
  applyCalibration,
  getSearchContext,
  type ExclusionList,
} from './exclusion.js';
import type { ValidatedProfile, GatingConfig } from './types.js';

const TEST_EXCLUSIONS_FILE = 'exclusions.json';

// Helper to create test profile
function createTestProfile(overrides: Partial<ValidatedProfile> = {}): ValidatedProfile {
  return {
    name: 'Test User',
    handle: '@testuser',
    primaryUrl: 'https://github.com/testuser',
    languages: ['TypeScript'],
    engineeringFocus: 'Full Stack',
    geography: 'Remote',
    signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
    citations: [],
    ...overrides,
  };
}

// Clean up exclusions file before and after each test
beforeEach(async () => {
  try {
    await fs.unlink(TEST_EXCLUSIONS_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
});

afterEach(async () => {
  try {
    await fs.unlink(TEST_EXCLUSIONS_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
});

describe('Exclusion List Persistence', () => {
  test('loadExclusions returns empty list when file does not exist', async () => {
    const list = await loadExclusions();
    expect(list.excluded).toEqual([]);
    expect(list.lastUpdated).toBeTruthy();
  });

  test('saveExclusions writes list to disk', async () => {
    const list: ExclusionList = {
      excluded: [
        {
          name: 'Alice',
          primaryUrl: 'https://github.com/alice',
          excludedAt: '2026-02-07T10:00:00Z',
          searchContext: 'Backend | Go, Rust | Distributed systems',
        },
      ],
      lastUpdated: '2026-02-07T10:00:00Z',
    };

    await saveExclusions(list);

    const loaded = await loadExclusions();
    expect(loaded.excluded).toHaveLength(1);
    expect(loaded.excluded[0].name).toBe('Alice');
    expect(loaded.excluded[0].primaryUrl).toBe('https://github.com/alice');
  });

  test('saveExclusions updates lastUpdated timestamp', async () => {
    const list: ExclusionList = {
      excluded: [],
      lastUpdated: '2026-01-01T00:00:00Z',
    };

    await saveExclusions(list);

    const loaded = await loadExclusions();
    expect(loaded.lastUpdated).not.toBe('2026-01-01T00:00:00Z');
    expect(new Date(loaded.lastUpdated).getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00Z').getTime()
    );
  });
});

describe('Adding to Exclusions', () => {
  test('addToExclusions appends profiles to empty list', async () => {
    const profiles: ValidatedProfile[] = [
      createTestProfile({
        name: 'Alice',
        handle: '@alice',
        primaryUrl: 'https://github.com/alice',
        languages: ['Go', 'Rust'],
        engineeringFocus: 'Backend',
      }),
    ];

    const updated = await addToExclusions(profiles, 'Backend | Go, Rust | Distributed systems');

    expect(updated.excluded).toHaveLength(1);
    expect(updated.excluded[0].name).toBe('Alice');
    expect(updated.excluded[0].primaryUrl).toBe('https://github.com/alice');
    expect(updated.excluded[0].searchContext).toBe('Backend | Go, Rust | Distributed systems');
  });

  test('addToExclusions appends to existing list', async () => {
    // Create initial exclusion
    await addToExclusions(
      [
        {
          name: 'Alice',
          handle: '@alice',
          primaryUrl: 'https://github.com/alice',
          languages: ['Go'],
          engineeringFocus: 'Backend',
          geography: 'Remote',
          signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
          citations: [],
          // removed discoveryMethod
        },
      ],
      'Context 1'
    );

    // Add second exclusion
    const updated = await addToExclusions(
      [
        {
          name: 'Bob',
          handle: '@bob',
          primaryUrl: 'https://github.com/bob',
          languages: ['Rust'],
          engineeringFocus: 'Backend',
          geography: 'Remote',
          signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
          citations: [],
          // removed discoveryMethod
        },
      ],
      'Context 2'
    );

    expect(updated.excluded).toHaveLength(2);
    expect(updated.excluded[0].name).toBe('Alice');
    expect(updated.excluded[1].name).toBe('Bob');
  });

  test('addToExclusions deduplicates by primaryUrl', async () => {
    const profile: ValidatedProfile = {
      name: 'Alice',
      handle: '@alice',
      primaryUrl: 'https://github.com/alice',
      languages: ['Go'],
      engineeringFocus: 'Backend',
      geography: 'Remote',
      signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
      citations: [],
      // removed discoveryMethod
    };

    // Add same profile twice
    await addToExclusions([profile], 'Context 1');
    const updated = await addToExclusions([profile], 'Context 2');

    // Should only have one entry
    expect(updated.excluded).toHaveLength(1);
    expect(updated.excluded[0].searchContext).toBe('Context 1'); // Original preserved
  });

  test('addToExclusions handles multiple profiles at once', async () => {
    const profiles: ValidatedProfile[] = [
      {
        name: 'Alice',
        handle: '@alice',
        primaryUrl: 'https://github.com/alice',
        languages: ['Go'],
        engineeringFocus: 'Backend',
        geography: 'Remote',
        signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
        citations: [],
        // removed discoveryMethod
      },
      {
        name: 'Bob',
        handle: '@bob',
        primaryUrl: 'https://github.com/bob',
        languages: ['Rust'],
        engineeringFocus: 'Backend',
        geography: 'Remote',
        signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
        citations: [],
        // removed discoveryMethod
      },
    ];

    const updated = await addToExclusions(profiles, 'Batch context');

    expect(updated.excluded).toHaveLength(2);
    expect(updated.excluded[0].name).toBe('Alice');
    expect(updated.excluded[1].name).toBe('Bob');
  });
});

describe('Removing from Exclusions', () => {
  test('removeFromExclusions removes specified candidates', async () => {
    // Add two exclusions
    await addToExclusions(
      [
        {
          name: 'Alice',
          handle: '@alice',
          primaryUrl: 'https://github.com/alice',
          languages: ['Go'],
          engineeringFocus: 'Backend',
          geography: 'Remote',
          signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
          citations: [],
          // removed discoveryMethod
        },
        {
          name: 'Bob',
          handle: '@bob',
          primaryUrl: 'https://github.com/bob',
          languages: ['Rust'],
          engineeringFocus: 'Backend',
          geography: 'Remote',
          signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
          citations: [],
          // removed discoveryMethod
        },
      ],
      'Context'
    );

    // Remove Alice
    const updated = await removeFromExclusions(['https://github.com/alice']);

    expect(updated.excluded).toHaveLength(1);
    expect(updated.excluded[0].name).toBe('Bob');
  });

  test('removeFromExclusions handles multiple URLs', async () => {
    // Add three exclusions
    await addToExclusions(
      [
        {
          name: 'Alice',
          handle: '@alice',
          primaryUrl: 'https://github.com/alice',
          languages: ['Go'],
          engineeringFocus: 'Backend',
          geography: 'Remote',
          signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
          citations: [],
          // removed discoveryMethod
        },
        {
          name: 'Bob',
          handle: '@bob',
          primaryUrl: 'https://github.com/bob',
          languages: ['Rust'],
          engineeringFocus: 'Backend',
          geography: 'Remote',
          signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
          citations: [],
          // removed discoveryMethod
        },
        {
          name: 'Charlie',
          handle: '@charlie',
          primaryUrl: 'https://github.com/charlie',
          languages: ['TypeScript'],
          engineeringFocus: 'Frontend',
          geography: 'Remote',
          signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
          citations: [],
          // removed discoveryMethod
        },
      ],
      'Context'
    );

    // Remove Alice and Bob
    const updated = await removeFromExclusions([
      'https://github.com/alice',
      'https://github.com/bob',
    ]);

    expect(updated.excluded).toHaveLength(1);
    expect(updated.excluded[0].name).toBe('Charlie');
  });

  test('removeFromExclusions handles non-existent URLs gracefully', async () => {
    await addToExclusions(
      [
        {
          name: 'Alice',
          handle: '@alice',
          primaryUrl: 'https://github.com/alice',
          languages: ['Go'],
          engineeringFocus: 'Backend',
          geography: 'Remote',
          signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
          citations: [],
          // removed discoveryMethod
        },
      ],
      'Context'
    );

    // Try to remove non-existent URL
    const updated = await removeFromExclusions(['https://github.com/nonexistent']);

    // Alice should still be excluded
    expect(updated.excluded).toHaveLength(1);
    expect(updated.excluded[0].name).toBe('Alice');
  });
});

describe('Filtering Profiles', () => {
  test('filterExcludedProfiles removes excluded candidates', () => {
    const profiles: ValidatedProfile[] = [
      {
        name: 'Alice',
        handle: '@alice',
        primaryUrl: 'https://github.com/alice',
        languages: ['Go'],
        engineeringFocus: 'Backend',
        geography: 'Remote',
        signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
        citations: [],
        // removed discoveryMethod
      },
      {
        name: 'Bob',
        handle: '@bob',
        primaryUrl: 'https://github.com/bob',
        languages: ['Rust'],
        engineeringFocus: 'Backend',
        geography: 'Remote',
        signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
        citations: [],
        // removed discoveryMethod
      },
    ];

    const exclusions: ExclusionList = {
      excluded: [
        {
          name: 'Alice',
          primaryUrl: 'https://github.com/alice',
          excludedAt: '2026-02-07T10:00:00Z',
          searchContext: 'Context',
        },
      ],
      lastUpdated: '2026-02-07T10:00:00Z',
    };

    const filtered = filterExcludedProfiles(profiles, exclusions);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Bob');
  });

  test('filterExcludedProfiles returns all profiles when exclusion list empty', () => {
    const profiles: ValidatedProfile[] = [
      {
        name: 'Alice',
        handle: '@alice',
        primaryUrl: 'https://github.com/alice',
        languages: ['Go'],
        engineeringFocus: 'Backend',
        geography: 'Remote',
        signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
        citations: [],
        // removed discoveryMethod
      },
    ];

    const exclusions: ExclusionList = {
      excluded: [],
      lastUpdated: '2026-02-07T10:00:00Z',
    };

    const filtered = filterExcludedProfiles(profiles, exclusions);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Alice');
  });

  test('filterExcludedProfiles returns empty array when all excluded', () => {
    const profiles: ValidatedProfile[] = [
      {
        name: 'Alice',
        handle: '@alice',
        primaryUrl: 'https://github.com/alice',
        languages: ['Go'],
        engineeringFocus: 'Backend',
        geography: 'Remote',
        signals: { code: true, depth: true, sustained: true, thinking: false, peer: false },
        citations: [],
        // removed discoveryMethod
      },
    ];

    const exclusions: ExclusionList = {
      excluded: [
        {
          name: 'Alice',
          primaryUrl: 'https://github.com/alice',
          excludedAt: '2026-02-07T10:00:00Z',
          searchContext: 'Context',
        },
      ],
      lastUpdated: '2026-02-07T10:00:00Z',
    };

    const filtered = filterExcludedProfiles(profiles, exclusions);

    expect(filtered).toHaveLength(0);
  });
});

describe('Exclusion Count', () => {
  test('getExclusionCount returns correct count', () => {
    const exclusions: ExclusionList = {
      excluded: [
        {
          name: 'Alice',
          primaryUrl: 'https://github.com/alice',
          excludedAt: '2026-02-07T10:00:00Z',
          searchContext: 'Context',
        },
        {
          name: 'Bob',
          primaryUrl: 'https://github.com/bob',
          excludedAt: '2026-02-07T10:00:00Z',
          searchContext: 'Context',
        },
      ],
      lastUpdated: '2026-02-07T10:00:00Z',
    };

    expect(getExclusionCount(exclusions)).toBe(2);
  });

  test('getExclusionCount returns zero for empty list', () => {
    const exclusions: ExclusionList = {
      excluded: [],
      lastUpdated: '2026-02-07T10:00:00Z',
    };

    expect(getExclusionCount(exclusions)).toBe(0);
  });
});

describe('Feedback Parsing', () => {
  test('parseFeedback detects show_more intent', () => {
    expect(parseFeedback('show me 20 more')).toEqual({ type: 'show_more' });
    expect(parseFeedback('more candidates')).toEqual({ type: 'show_more' });
    expect(parseFeedback('next batch')).toEqual({ type: 'show_more' });
    expect(parseFeedback('more')).toEqual({ type: 'show_more' });
  });

  test('parseFeedback detects include_override intent', () => {
    const result = parseFeedback('include Alice again');
    expect(result.type).toBe('include_override');
    expect(result.includeOverrides).toEqual(['alice']);
  });

  test('parseFeedback detects calibrate intent for focus', () => {
    let result = parseFeedback('more systems-focused');
    expect(result.type).toBe('calibrate');
    expect(result.calibration?.engineeringFocus).toBe('Backend/Systems');

    result = parseFeedback('less frontend');
    expect(result.type).toBe('calibrate');
    expect(result.calibration?.engineeringFocus).toBe('Backend/Systems');

    result = parseFeedback('more frontend');
    expect(result.type).toBe('calibrate');
    expect(result.calibration?.engineeringFocus).toBe('Frontend');

    result = parseFeedback('more full stack engineers');
    expect(result.type).toBe('calibrate');
    expect(result.calibration?.engineeringFocus).toBe('Full Stack');
  });

  test('parseFeedback detects calibrate intent for depth', () => {
    let result = parseFeedback('more distributed systems experience');
    expect(result.type).toBe('calibrate');
    expect(result.calibration?.depthExpectation).toBe('Distributed systems and infrastructure');

    result = parseFeedback('more infrastructure folks');
    expect(result.type).toBe('calibrate');
    expect(result.calibration?.depthExpectation).toBe('Infrastructure and DevOps');
  });

  test('parseFeedback detects calibrate intent for geography', () => {
    const result = parseFeedback('candidates based in Austin');
    expect(result.type).toBe('calibrate');
    expect(result.calibration?.geography).toBe('austin');
  });

  test('parseFeedback defaults to show_more for unrecognized input', () => {
    expect(parseFeedback('random text here')).toEqual({ type: 'show_more' });
  });
});

describe('Calibration Application', () => {
  test('applyCalibration merges calibration into config', () => {
    const config: GatingConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go', 'Rust'],
      depthExpectation: 'Distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs'],
      geography: 'Remote',
    };

    const calibration: Partial<GatingConfig> = {
      engineeringFocus: 'Full Stack',
      geography: 'Austin',
    };

    const result = applyCalibration(config, calibration);

    expect(result.engineeringFocus).toBe('Full Stack');
    expect(result.geography).toBe('Austin');
    expect(result.languages).toEqual(['Go', 'Rust']); // Unchanged
    expect(result.depthExpectation).toBe('Distributed systems'); // Unchanged
  });

  test('applyCalibration returns unchanged config when calibration empty', () => {
    const config: GatingConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go'],
      depthExpectation: 'Distributed systems',
      evidencePriorities: ['GitHub repos'],
      geography: 'Remote',
    };

    const result = applyCalibration(config, {});

    expect(result).toEqual(config);
  });
});

describe('Search Context', () => {
  test('getSearchContext formats config as context string', () => {
    const config: GatingConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go', 'Rust'],
      depthExpectation: 'Distributed systems and infrastructure',
      evidencePriorities: ['GitHub repos', 'Tech blogs'],
      geography: 'Remote',
    };

    const context = getSearchContext(config);

    expect(context).toBe('Backend | Go, Rust | Distributed systems and infrastructure');
  });

  test('getSearchContext handles single language', () => {
    const config: GatingConfig = {
      engineeringFocus: 'Frontend',
      languages: ['TypeScript'],
      depthExpectation: 'React performance',
      evidencePriorities: ['GitHub repos'],
      geography: 'Remote',
    };

    const context = getSearchContext(config);

    expect(context).toBe('Frontend | TypeScript | React performance');
  });
});
