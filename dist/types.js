/**
 * @crumb
 * @id types-foundation
 * @area DAT
 * @intent Codify validation contracts (signals, gating, evidence) so all domains consume identical schemas
 * @responsibilities Zod schema definitions, type inference, signal validation, profile structure
 * @contracts EvidencePriority enum → 5 values; GatingConfigSchema → {engineeringFocus, languages[1-3], depthExpectation, evidencePriorities[2-3], geography?}; SignalName → 'code'|'depth'|'sustained'|'thinking'|'peer'; Citation → {signal, url, description}; ValidatedProfile → {name, handle?, primaryUrl, languages[], engineeringFocus, geography?, signals: Record<SignalName, bool>, citations[], discoverySource?}
 * @hazard No schema versioning mechanism — breaking changes to signal types undetected downstream
 * @hazard Zod validation bypassed at module boundaries (consumers use `as` casts) — runtime type safety lost
 * @shared-edges discovery.ts→CONSUMES, validation.ts→CONSUMES, enforcement.ts→CONSUMES, hybrid-discovery.ts→CONSUMES, report.ts→CONSUMES
 * @prompt Before modifying signal types or GatingConfigSchema, audit all 4 validators for breaking changes. Add schema versioning.
 */
import { z } from 'zod';
export const EvidencePriority = z.enum([
    'GitHub repos',
    'OSS contributions',
    'Tech blogs',
    'Conference talks',
    'Stack Overflow depth'
]);
export const GatingConfigSchema = z.object({
    engineeringFocus: z.string().min(1, 'Engineering focus is required'),
    languages: z.array(z.string()).min(1).max(3, 'Maximum 3 languages allowed'),
    depthExpectation: z.string().min(1, 'Depth expectation is required'),
    evidencePriorities: z.array(EvidencePriority).min(2).max(3, 'Choose 2-3 evidence priorities'),
    geography: z.string().optional().default('')
});
//# sourceMappingURL=types.js.map