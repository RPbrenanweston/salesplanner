import { GatingConfig } from './types.js';
export declare function saveConfig(config: GatingConfig): void;
export declare function loadConfig(): GatingConfig | null;
export declare function validateConfig(config: unknown): {
    valid: boolean;
    errors?: string[];
};
//# sourceMappingURL=config.d.ts.map