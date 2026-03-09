/**
 * @crumb
 * @id backend-gating-interactive
 * @area UI/CLI
 * @intent Interactive gating — collect search parameters (engineering focus, languages, depth, evidence priorities, geography) from the user via CLI prompts, validate, and save as GatingConfig
 * @responsibilities Prompt user for each GatingConfig field via readline, validate inputs, construct GatingConfig, call saveConfig to persist
 * @contracts collectGatingAnswers() → Promise<GatingConfig>; uses readline.createInterface on stdin/stdout; calls saveConfig(config) on completion
 * @in stdin (user keyboard input), GatingConfig type + EvidencePriority enum from types.ts, saveConfig from config.ts
 * @out GatingConfig object returned; config.json written via saveConfig
 * @err Invalid input (prompts re-asked or defaults applied); saveConfig failure (Zod validation error thrown — config not saved)
 * @hazard readline.createInterface on stdin/stdout is not cleaned up — if the user terminates mid-prompt (Ctrl+C), the readline interface may hold stdin open, preventing the process from exiting cleanly
 * @hazard Gating answers collected interactively every run — if the agent is run in a CI/CD or non-interactive environment (no TTY), readline prompts will hang indefinitely waiting for stdin that never comes
 * @shared-edges src/types.ts→IMPORTS GatingConfig + EvidencePriority; src/config.ts→CALLS saveConfig; src/index.ts→CALLS collectGatingAnswers when no config found
 * @trail gating#1 | index.ts detects no config.json → calls collectGatingAnswers → user answers CLI prompts → GatingConfig built → saveConfig writes config.json → config returned
 * @prompt Add rl.close() after config collection. Add --config flag to index.ts to skip interactive gating for CI use.
 */
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { GatingConfig, EvidencePriority } from './types.js';
import { saveConfig } from './config.js';

export async function collectGatingAnswers(): Promise<GatingConfig> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('\n=== CodeSignal-20 Gating Questions ===\n');
    console.log('All questions are mandatory. The agent will not run without complete answers.\n');

    const engineeringFocus = await rl.question('1. Target engineering focus (e.g., Backend, Frontend, Full-stack, DevOps): ');
    if (!engineeringFocus.trim()) {
      throw new Error('Engineering focus is required');
    }

    const languagesRaw = await rl.question('2. Required languages (comma-separated, max 3): ');
    const languages = languagesRaw.split(',').map(l => l.trim()).filter(l => l.length > 0);
    if (languages.length === 0) {
      throw new Error('At least one language is required');
    }
    if (languages.length > 3) {
      throw new Error('Maximum 3 languages allowed');
    }

    const depthExpectation = await rl.question('3. Minimum depth expectation (e.g., distributed systems, performance optimization): ');
    if (!depthExpectation.trim()) {
      throw new Error('Depth expectation is required');
    }

    console.log('\n4. Evidence priorities (choose 2-3):');
    console.log('   a) GitHub repos');
    console.log('   b) OSS contributions');
    console.log('   c) Tech blogs');
    console.log('   d) Conference talks');
    console.log('   e) Stack Overflow depth');
    const evidenceRaw = await rl.question('   Enter choices (comma-separated, e.g., a,c,d): ');
    const evidenceChoices = evidenceRaw.split(',').map(c => c.trim().toLowerCase());

    const evidenceMap: Record<string, EvidencePriority> = {
      'a': 'GitHub repos',
      'b': 'OSS contributions',
      'c': 'Tech blogs',
      'd': 'Conference talks',
      'e': 'Stack Overflow depth'
    };

    const evidencePriorities = evidenceChoices
      .map(c => evidenceMap[c])
      .filter((e): e is EvidencePriority => e !== undefined);

    if (evidencePriorities.length < 2 || evidencePriorities.length > 3) {
      throw new Error('Must choose 2-3 evidence priorities');
    }

    const geography = await rl.question('5. Geography constraints (optional, press Enter to skip): ');

    const config: GatingConfig = {
      engineeringFocus: engineeringFocus.trim(),
      languages,
      depthExpectation: depthExpectation.trim(),
      evidencePriorities,
      geography: geography.trim()
    };

    saveConfig(config);
    console.log('\n✓ Configuration saved to config.json\n');

    return config;
  } finally {
    rl.close();
  }
}
