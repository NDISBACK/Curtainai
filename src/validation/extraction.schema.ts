import { z } from 'zod';

export const ExtractConversationSchema = z.object({
  conversation:  z.string().trim().min(1).max(50000).optional(),
  conversations: z.array(z.string().trim().min(1).max(50000)).max(10).optional(),
  deep:          z.boolean().optional().default(false),
  workspace_id:  z.string().uuid().optional(),
}).refine(
  d => !!(d.conversation || (d.conversations && d.conversations.length > 0)),
  { message: 'conversation or conversations is required' }
);

export const ExtractedSkillSchema = z.object({
  name: z.string().trim().min(1).max(200),
  trigger_condition: z.string().trim().min(1).max(500),
  decision: z.string().trim().min(1).max(500),
  conditions: z.array(z.unknown()).transform(arr => arr.map(c => String(c))).default([]),
  escalation_required: z.union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform(v => v === true || v === 'true').default(false),
  confidence: z.number().min(0).max(1).catch(0.5),
}).passthrough(); // allow 'category' through for internal use — stripped before returning

export const LLMExtractionResponseSchema = z.object({
  skills: z.array(z.unknown()),
});

export type ExtractConversationInput = z.infer<typeof ExtractConversationSchema>;
