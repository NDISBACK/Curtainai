import { z } from 'zod';

export const GmailConfigSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
  email:         z.string().email().optional(),
});

export const WhatsAppConfigSchema = z.object({
  api_token:            z.string().min(1, 'api_token is required'),
  phone_number_id:      z.string().min(1, 'phone_number_id is required'),
  business_account_id:  z.string().min(1, 'business_account_id is required'),
});

export const FreshdeskConfigSchema = z.object({
  domain:  z.string().min(1).regex(
    /^[a-z0-9-]+\.freshdesk\.com$/i,
    'domain must be in the format "yourcompany.freshdesk.com"'
  ),
  api_key: z.string().min(1, 'api_key is required'),
});

export const CreateIntegrationSchema = z.object({
  provider: z.enum(['gmail', 'whatsapp', 'freshdesk']),
  config:   z.record(z.unknown()),
});

// Validate the inner config shape per provider
export const CONFIG_SCHEMAS = {
  gmail:     GmailConfigSchema,
  whatsapp:  WhatsAppConfigSchema,
  freshdesk: FreshdeskConfigSchema,
} as const;

// Extracted skills submitted for confirmation (from the sync preview)
export const ExtractedSkillSchema = z.object({
  name:               z.string().trim().min(1).max(200),
  trigger_condition:  z.string().trim().min(1).max(500),
  decision:           z.string().trim().min(1).max(500),
  conditions:         z.array(z.string()).default([]),
  escalation_required: z.boolean().default(false),
  confidence:         z.number().min(0).max(1),
});

export const ConfirmSyncSchema = z.object({
  skills: z.array(ExtractedSkillSchema).min(1).max(200),
});

export type CreateIntegrationInput = z.infer<typeof CreateIntegrationSchema>;
export type ConfirmSyncInput       = z.infer<typeof ConfirmSyncSchema>;
