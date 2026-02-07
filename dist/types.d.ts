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
//# sourceMappingURL=types.d.ts.map