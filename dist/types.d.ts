import { z } from 'zod';
export declare const EvidencePriority: z.ZodEnum<["GitHub repos", "OSS contributions", "Tech blogs", "Conference talks", "Stack Overflow depth"]>;
export type EvidencePriority = z.infer<typeof EvidencePriority>;
export declare const GatingConfigSchema: z.ZodObject<{
    engineeringFocus: z.ZodString;
    languages: z.ZodArray<z.ZodString, "many">;
    depthExpectation: z.ZodString;
    evidencePriorities: z.ZodArray<z.ZodEnum<["GitHub repos", "OSS contributions", "Tech blogs", "Conference talks", "Stack Overflow depth"]>, "many">;
    geography: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    engineeringFocus: string;
    languages: string[];
    depthExpectation: string;
    evidencePriorities: ("GitHub repos" | "OSS contributions" | "Tech blogs" | "Conference talks" | "Stack Overflow depth")[];
    geography: string;
}, {
    engineeringFocus: string;
    languages: string[];
    depthExpectation: string;
    evidencePriorities: ("GitHub repos" | "OSS contributions" | "Tech blogs" | "Conference talks" | "Stack Overflow depth")[];
    geography?: string | undefined;
}>;
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
//# sourceMappingURL=types.d.ts.map