import { z } from 'zod';

export const RunQuerySchema = z.object({
  query: z.string().trim().min(1, 'query is required'),
  // workspace_id is now sourced from the authenticated API key — no longer required in body
});

export const SubmitOverrideSchema = z.object({
  query_id: z.string().trim().min(1, 'query_id is required'),
  corrected_decision: z.string().trim().min(1, 'corrected_decision is required'),
});

export const LLMSelectionResponseSchema = z.object({
  decision: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  skill_id: z.string().nullable(),
  escalate: z.boolean(),
});

export type RunQueryInput = z.infer<typeof RunQuerySchema>;
export type SubmitOverrideInput = z.infer<typeof SubmitOverrideSchema>;
export type LLMSelectionResponse = z.infer<typeof LLMSelectionResponseSchema>;
