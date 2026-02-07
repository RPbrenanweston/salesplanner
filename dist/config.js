import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GatingConfigSchema } from './types.js';
const CONFIG_PATH = './config.json';
export function saveConfig(config) {
    const validated = GatingConfigSchema.parse(config);
    writeFileSync(CONFIG_PATH, JSON.stringify(validated, null, 2), 'utf-8');
}
export function loadConfig() {
    if (!existsSync(CONFIG_PATH)) {
        return null;
    }
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return GatingConfigSchema.parse(parsed);
}
export function validateConfig(config) {
    try {
        GatingConfigSchema.parse(config);
        return { valid: true };
    }
    catch (error) {
        const errors = error.errors?.map((e) => e.message) || [error.message];
        return { valid: false, errors };
    }
}
//# sourceMappingURL=config.js.map