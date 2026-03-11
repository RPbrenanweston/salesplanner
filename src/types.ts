// @crumb types-foundation
// DAT | zod_schema_definitions | type_inference | signal_validation | profile_structure
// why: Codify validation contracts (signals, gating, evidence) so all domains consume identical schemas
// in:N/A (type definitions only) out:EvidencePriority enum, GatingConfigSchema, SignalName, Citation, ValidatedProfile types err:N/A
// hazard: No schema versioning mechanism — breaking changes to signal types undetected downstream
// hazard: Zod validation bypassed at module boundaries (consumers use `as` casts) — runtime type safety lost
// edge:src/discovery.ts -> READS
// edge:src/validation.ts -> READS
// edge:src/enforcement.ts -> READS
// edge:src/hybrid-discovery.ts -> READS
// edge:src/report.ts -> READS
// prompt: Before modifying signal types or GatingConfigSchema, audit all 4 validators for breaking changes. Add schema versioning.

import { z } from 'zod';

export const EvidencePriority = z.enum([
  'GitHub repos',
  'OSS contributions',
  'Tech blogs',
  'Conference talks',
  'Stack Overflow depth'
]);

export type EvidencePriority = z.infer<typeof EvidencePriority>;

export const GatingConfigSchema = z.object({
  engineeringFocus: z.string().min(1, 'Engineering focus is required'),
  languages: z.array(z.string()).min(1).max(3, 'Maximum 3 languages allowed'),
  depthExpectation: z.string().min(1, 'Depth expectation is required'),
  evidencePriorities: z.array(EvidencePriority).min(2).max(3, 'Choose 2-3 evidence priorities'),
  geography: z.string().optional().default('')
});

export type GatingConfig = z.infer<typeof GatingConfigSchema>;

/**
 * Signal types for validation
 */
export type SignalName = 'code' | 'depth' | 'sustained' | 'thinking' | 'peer';

/**
 * A citation linking a factual claim to a verifiable source.
 */
export interface Citation {
  signal: SignalName;
  url: string;
  description: string;
}

/**
 * Validated profile ready for inclusion in final report.
 */
export interface ValidatedProfile {
  name: string;
  handle?: string;
  primaryUrl: string;
  languages: string[];
  engineeringFocus: string;
  geography?: string;
  signals: Record<SignalName, boolean>;
  citations: Citation[];
  discoverySource?: {
    method: string;
    query: string;
    discoveredAt: Date;
  };
}
