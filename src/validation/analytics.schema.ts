import { z } from 'zod';

export const DateRangeSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to:   z.string().datetime({ offset: true }).optional(),
});

export const QueryHistorySchema = z.object({
  from:      z.string().datetime({ offset: true }).optional(),
  to:        z.string().datetime({ offset: true }).optional(),
  escalated: z.preprocess(
    v => v === 'true' ? true : v === 'false' ? false : undefined,
    z.boolean().optional()
  ),
  skill_id:  z.string().uuid().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});

export type DateRangeInput    = z.infer<typeof DateRangeSchema>;
export type QueryHistoryInput = z.infer<typeof QueryHistorySchema>;
