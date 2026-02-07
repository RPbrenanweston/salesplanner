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
