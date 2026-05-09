import { z } from 'zod';

export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
});

const WorkspaceSettingsSchema = z.object({
  top_k: z.number().int().min(1).max(20).optional(),
  duplicate_threshold: z.number().min(0).max(1).optional(),
  hybrid_alpha: z.number().min(0).max(1).optional(),
  escalation_webhook_url: z.string().url().nullable().optional(),
  escalation_email: z.string().email().nullable().optional(),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  settings: WorkspaceSettingsSchema.optional(),
});

export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  expires_at: z.string().datetime().optional(),
  scope: z.enum(['full', 'read_only', 'query_only']).default('full'),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
