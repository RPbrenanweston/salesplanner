/**
 * @crumb
 * @id backend-config-persistence
 * @area DAT
 * @intent Config persistence — save and load GatingConfig to/from config.json on disk, validated with Zod schema before writing
 * @responsibilities saveConfig (validate + write config.json), loadConfig (read + parse config.json or return undefined if missing)
 * @contracts saveConfig(config: GatingConfig) → void; loadConfig() → GatingConfig | undefined; uses GatingConfigSchema.parse for validation; writes to ./config.json
 * @in GatingConfig object, GatingConfigSchema from types.ts, fs.readFileSync + writeFileSync
 * @out config.json file written to disk; GatingConfig object on load; undefined if file does not exist
 * @err GatingConfigSchema.parse failure (Zod throws ZodError on save — bad config not written); JSON.parse failure (malformed config.json — loadConfig throws, caller must handle)
 * @hazard config.json is written to the working directory — if the agent is run from different directories, each directory gets its own config.json, causing silently divergent configurations between run locations
 * @hazard loadConfig does not call GatingConfigSchema.parse on read — a manually edited config.json that violates the schema will load without validation errors and cause runtime failures downstream when the config fields are used
 * @shared-edges src/types.ts→IMPORTS GatingConfig + GatingConfigSchema; src/gating.ts→CALLS saveConfig; src/index.ts→CALLS loadConfig; ./config.json→READS and WRITES
 * @trail config#1 | User runs agent → index.ts calls loadConfig → config.json exists → GatingConfig returned → agent uses config; or config missing → returns undefined → gating.ts prompts user to configure
 * @prompt Add GatingConfigSchema.parse validation on loadConfig to catch manually-edited config drift. Consider config path as CLI argument rather than hardcoded './config.json'.
 */
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
