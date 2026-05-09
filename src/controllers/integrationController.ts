import { Request, Response } from 'express';
import { env } from '../config/env';
import { integrationService } from '../services/integrationService';
import { gmailService } from '../services/gmailService';
import { integrationRepository } from '../repositories/integrationRepository';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { validateOrThrow } from '../validation';
import {
  CreateIntegrationSchema,
  ConfirmSyncSchema,
} from '../validation/integration.schema';
import type { IntegrationProvider } from '../types/entities';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireId(req: Request): string {
  const { id } = req.params;
  if (!id?.trim()) throw new AppError('integration id is required', 400);
  return id;
}

// ─── Authenticated handlers ───────────────────────────────────────────────────

export const listIntegrations = catchAsync(async (req: Request, res: Response) => {
  const integrations = await integrationService.listForWorkspace(req.workspace.id);
  sendSuccess(res, integrations);
});

export const createIntegration = catchAsync(async (req: Request, res: Response) => {
  const { provider, config } = validateOrThrow(CreateIntegrationSchema, req.body);
  const integration = await integrationService.upsert(
    req.workspace.id,
    provider as IntegrationProvider,
    config
  );
  sendSuccess(res, integration, 201);
});

export const deleteIntegration = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await integrationService.disconnect(id, req.workspace.id);
  res.status(204).send();
});

export const syncIntegration = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  const limit       = Math.min(Number(req.query.limit) || 200, 500);
  const deepExtract = req.query.deep === 'true';
  const jobId = await integrationService.startSync(id, req.workspace.id, limit, deepExtract);
  sendSuccess(res, { job_id: jobId, status: 'running' }, 202);
});

export const getSyncStatus = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  const jobId = req.query.job_id as string;
  if (!jobId?.trim()) throw new AppError('job_id query param is required', 400);

  const job = integrationService.getSyncStatus(jobId);

  // Verify job belongs to this workspace — prevents job ID guessing across workspaces
  if (job.workspace_id !== req.workspace.id) {
    throw new AppError('sync job not found or expired', 404);
  }

  // Suppress id in response — integration_id is sufficient; /:id is just for auth
  void id;

  sendSuccess(res, {
    status:   job.status,
    progress: job.progress,
    ...(job.result && { result: job.result }),
    ...(job.error  && { error:  job.error  }),
  });
});

export const confirmSync = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  const { skills } = validateOrThrow(ConfirmSyncSchema, req.body);
  // Ensure conditions is always string[] — Zod .default([]) infers as optional
  const normalised = skills.map(s => ({
    ...s,
    conditions:         s.conditions ?? [],
    escalation_required: s.escalation_required ?? false,
  }));
  const result = await integrationService.confirm(id, req.workspace.id, normalised);
  sendSuccess(res, result, 201);
});

// ─── Gmail OAuth handlers (start is authenticated, callback is public) ────────

// Returns the OAuth URL as JSON — frontend fetches this (with Auth header), then redirects
export const getGmailOAuthUrl = catchAsync(async (req: Request, res: Response) => {
  const url = gmailService.getAuthUrl(req.workspace.id);
  sendSuccess(res, { url });
});

export const gmailOAuthCallback = catchAsync(async (req: Request, res: Response) => {
  const code      = req.query.code as string;
  const workspaceId = req.query.state as string;

  if (!code || !workspaceId) {
    throw new AppError('invalid OAuth callback — missing code or state', 400);
  }

  // Basic UUID format check to prevent injection via state param
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    throw new AppError('invalid state parameter', 400);
  }

  const { refresh_token, email } = await gmailService.exchangeCode(code);

  await integrationRepository.upsert({
    workspace_id:   workspaceId,
    provider:       'gmail',
    status:         'active',
    config:         { refresh_token, email },
    last_synced_at: null,
  });

  const base = env.frontendUrl || '';
  res.redirect(`${base}/app.html?connected=gmail`);
});

export const cancelSync = catchAsync(async (req: Request, res: Response) => {
  const { job_id } = req.body as { job_id?: string };
  if (!job_id?.trim()) throw new AppError('job_id is required', 400);
  integrationService.cancelSync(job_id, req.workspace.id);
  sendSuccess(res, { cancelled: true });
});
