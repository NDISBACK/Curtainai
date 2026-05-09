import { z } from 'zod';

const SkillBaseSchema = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  name: z.string().trim().min(1).max(200),
  trigger_condition: z.string().trim().min(1).max(500),
  decision: z.string().trim().min(1).max(500),
  conditions: z.record(z.unknown()).nullable().optional(),
  escalation_required: z.boolean().optional().default(false),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const CreateSkillSchema = SkillBaseSchema;
export const UpdateSkillSchema = SkillBaseSchema.partial().omit({ workspace_id: true });

export const ListSkillsQuerySchema = z.object({
  status: z.enum(['pending_review', 'active', 'disabled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
});

export const BatchApproveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

// ─── Export / Import ──────────────────────────────────────────────────────────

export const ExportQuerySchema = z.object({
  format: z.enum(['openai_functions', 'mcp_tools', 'langchain', 'json']).default('json'),
  status: z.enum(['pending_review', 'active', 'disabled']).default('active'),
});

const ImportSkillItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  trigger_condition: z.string().trim().min(1).max(500),
  decision: z.string().trim().min(1).max(500),
  conditions: z.record(z.unknown()).nullable().optional(),
  escalation_required: z.boolean().optional().default(false),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const ImportSkillsSchema = z.object({
  skills: z.array(ImportSkillItemSchema).min(1).max(500),
});

export type CreateSkillInput = z.infer<typeof CreateSkillSchema>;
export type UpdateSkillInput = z.infer<typeof UpdateSkillSchema>;
export type ListSkillsQuery = z.infer<typeof ListSkillsQuerySchema>;
export type ExportQuery = z.infer<typeof ExportQuerySchema>;
export type ImportSkillsInput = z.infer<typeof ImportSkillsSchema>;
