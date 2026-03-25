// @crumb backend-gating-interactive
// UI/CLI | readline_prompting | input_validation | gating_config_construction | config_persistence
// why: Interactive gating — collect search parameters (engineering focus, languages, depth, evidence priorities, geography) from the user via CLI prompts, validate, and save as GatingConfig
// in:stdin (user keyboard input), GatingConfig type + EvidencePriority enum from types.ts, saveConfig from config.ts out:GatingConfig object returned; config.json written via saveConfig err:Invalid input (prompts re-asked or defaults applied); saveConfig failure (Zod validation error thrown)
// hazard: readline.createInterface on stdin/stdout is not cleaned up — Ctrl+C mid-prompt may hold stdin open preventing clean exit
// hazard: Gating answers collected interactively every run — CI/CD or non-interactive environments will hang indefinitely
// edge:src/types.ts -> READS
// edge:src/config.ts -> CALLS
// edge:src/index.ts -> SERVES
// edge:gating#1 -> STEP_IN
// prompt: Add rl.close() after config collection. Add --config flag to index.ts to skip interactive gating for CI use.
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
