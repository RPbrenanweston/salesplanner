import { describe, test, expect } from '@jest/globals';
import { validateConfig } from './config.js';
import { GatingConfig } from './types.js';

describe('Config Validation', () => {
  test('accepts valid complete config', () => {
    const validConfig: GatingConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go', 'Rust'],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs'],
      geography: 'US'
    };

    const result = validateConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('rejects config with missing engineering focus', () => {
    const invalidConfig = {
      engineeringFocus: '',
      languages: ['Go'],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs']
    };

    const result = validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('Engineering focus'))).toBe(true);
  });

  test('rejects config with empty languages array', () => {
    const invalidConfig = {
      engineeringFocus: 'Backend',
      languages: [],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs']
    };

    const result = validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  test('rejects config with more than 3 languages', () => {
    const invalidConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go', 'Rust', 'Python', 'JavaScript'],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs']
    };

    const result = validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.includes('Maximum 3 languages'))).toBe(true);
  });

  test('rejects config with missing depth expectation', () => {
    const invalidConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go'],
      depthExpectation: '',
      evidencePriorities: ['GitHub repos', 'Tech blogs']
    };

    const result = validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.includes('Depth expectation'))).toBe(true);
  });

  test('rejects config with fewer than 2 evidence priorities', () => {
    const invalidConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go'],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['GitHub repos']
    };

    const result = validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
  });

  test('rejects config with more than 3 evidence priorities', () => {
    const invalidConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go'],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs', 'Conference talks', 'OSS contributions']
    };

    const result = validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.includes('Choose 2-3 evidence priorities'))).toBe(true);
  });

  test('rejects config with invalid evidence priority', () => {
    const invalidConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go'],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['Invalid priority', 'Tech blogs']
    };

    const result = validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
  });

  test('accepts config with optional geography omitted', () => {
    const validConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go'],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs']
    };

    const result = validateConfig(validConfig);
    expect(result.valid).toBe(true);
  });

  test('accepts config with geography provided', () => {
    const validConfig: GatingConfig = {
      engineeringFocus: 'Backend',
      languages: ['Go'],
      depthExpectation: 'distributed systems',
      evidencePriorities: ['GitHub repos', 'Tech blogs'],
      geography: 'Europe'
    };

    const result = validateConfig(validConfig);
    expect(result.valid).toBe(true);
  });
});
