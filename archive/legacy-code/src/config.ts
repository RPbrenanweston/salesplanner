// @crumb backend-config-persistence
// DAT | config_validation | config_file_write | config_file_read | zod_schema_parsing
// why: Config persistence — save and load GatingConfig to/from config.json on disk, validated with Zod schema before writing
// in:GatingConfig object, GatingConfigSchema from types.ts, fs.readFileSync + writeFileSync out:config.json file written to disk; GatingConfig object on load; null if file does not exist err:GatingConfigSchema.parse failure (Zod throws ZodError on save); JSON.parse failure on malformed config.json
// hazard: config.json is written to the working directory — different directories get silently divergent configurations
// hazard: loadConfig does not call GatingConfigSchema.parse on read — manually edited config.json that violates schema causes runtime failures downstream
// edge:src/types.ts -> READS
// edge:src/gating.ts -> SERVES
// edge:src/index.ts -> SERVES
// edge:config#1 -> STEP_IN
// prompt: Add GatingConfigSchema.parse validation on loadConfig to catch manually-edited config drift. Consider config path as CLI argument rather than hardcoded './config.json'.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GatingConfig, GatingConfigSchema } from './types.js';

const CONFIG_PATH = './config.json';

export function saveConfig(config: GatingConfig): void {
  const validated = GatingConfigSchema.parse(config);
  writeFileSync(CONFIG_PATH, JSON.stringify(validated, null, 2), 'utf-8');
}

export function loadConfig(): GatingConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return GatingConfigSchema.parse(parsed);
}

export function validateConfig(config: unknown): { valid: boolean; errors?: string[] } {
  try {
    GatingConfigSchema.parse(config);
    return { valid: true };
  } catch (error: any) {
    const errors = error.errors?.map((e: any) => e.message) || [error.message];
    return { valid: false, errors };
  }
}
