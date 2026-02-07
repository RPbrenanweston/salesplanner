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
