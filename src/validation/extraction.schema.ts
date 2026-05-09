import { z } from 'zod';

export const ExtractConversationSchema = z.object({
  conversation: z.string().trim().min(1, 'conversation is required').max(50000),
});

export const ExtractedSkillSchema = z.object({
  name: z.string().trim().min(1).max(200),
  trigger_condition: z.string().trim().min(1).max(500),
  decision: z.string().trim().min(1).max(500),
  conditions: z.array(z.unknown()).transform(arr => arr.map(c => String(c))).default([]),
  escalation_required: z.union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform(v => v === true || v === 'true').default(false),
  confidence: z.number().min(0).max(1).catch(0.5),
});

export const LLMExtractionResponseSchema = z.object({
  skills: z.array(z.unknown()),
});

export type ExtractConversationInput = z.infer<typeof ExtractConversationSchema>;
