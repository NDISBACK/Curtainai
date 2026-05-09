import { Request, Response } from 'express';
import { workspaceRepository } from '../repositories/workspaceRepository';
import { apiKeyRepository } from '../repositories/apiKeyRepository';
import { generateApiKey } from '../utils/apiKey';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { validateOrThrow } from '../validation';
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  CreateApiKeySchema,
} from '../validation/workspace.schema';
import { auditService } from '../services/auditService';

// ─── Workspace ────────────────────────────────────────────────────────────────

export const createWorkspace = catchAsync(async (req: Request, res: Response) => {
  const { name } = validateOrThrow(CreateWorkspaceSchema, req.body);
  const workspace = await workspaceRepository.create({ name });
  sendSuccess(res, workspace, 201);
});

function assertWorkspaceOwnership(req: Request): void {
  if (req.params['id'] && req.params['id'] !== req.workspace.id) {
    throw new AppError('Workspace not found', 404);
  }
}

export const getWorkspace = catchAsync(async (req: Request, res: Response) => {
  assertWorkspaceOwnership(req);
  sendSuccess(res, req.workspace);
});

export const updateWorkspace = catchAsync(async (req: Request, res: Response) => {
  assertWorkspaceOwnership(req);
  const input = validateOrThrow(UpdateWorkspaceSchema, req.body);

  // Merge settings patch into existing settings rather than replacing the whole object
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch['name'] = input.name;
  if (input.settings !== undefined) {
    patch['settings'] = { ...req.workspace.settings, ...input.settings };
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError('No fields to update', 400);
  }

  const updated = await workspaceRepository.update(req.workspace.id, patch);
  sendSuccess(res, updated);
});

export const deleteWorkspace = catchAsync(async (req: Request, res: Response) => {
  assertWorkspaceOwnership(req);
  await workspaceRepository.delete(req.workspace.id);
  res.status(204).send();
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const createApiKey = catchAsync(async (req: Request, res: Response) => {
  assertWorkspaceOwnership(req);
  const input = validateOrThrow(CreateApiKeySchema, req.body);
  const { raw, hash, prefix } = generateApiKey();

  const apiKey = await apiKeyRepository.create({
    workspace_id: req.workspace.id,
    key_hash: hash,
    key_prefix: prefix,
    name: input.name,
    scope: (input.scope ?? 'full') as 'full' | 'read_only' | 'query_only',
    last_used_at: null,
    expires_at: input.expires_at ?? null,
    revoked_at: null,
  });

  auditService.log({
    workspaceId: req.workspace.id,
    actorKeyId: req.apiKeyId,
    action: 'api_key.created',
    resourceType: 'api_key',
    resourceId: apiKey.id,
    meta: { name: input.name, scope: input.scope },
  });

  // The raw key is returned only once — it cannot be retrieved again
  sendSuccess(res, {
    id: apiKey.id,
    name: apiKey.name,
    scope: apiKey.scope,
    key: raw,
    prefix: apiKey.key_prefix,
    expires_at: apiKey.expires_at,
    created_at: apiKey.created_at,
  }, 201);
});

export const listApiKeys = catchAsync(async (req: Request, res: Response) => {
  assertWorkspaceOwnership(req);
  const keys = await apiKeyRepository.findAllByWorkspace(req.workspace.id);

  // Never return key_hash — strip it before sending
  const safe = keys.map(({ key_hash: _kh, ...rest }) => rest);
  sendSuccess(res, safe);
});

export const revokeApiKey = catchAsync(async (req: Request, res: Response) => {
  assertWorkspaceOwnership(req);
  const { keyId } = req.params;
  if (!keyId?.trim()) throw new AppError('keyId is required', 400);

  // Fetch to verify the key belongs to this workspace
  const keys = await apiKeyRepository.findAllByWorkspace(req.workspace.id);
  const target = keys.find(k => k.id === keyId);
  if (!target) throw new AppError('API key not found', 404);
  if (target.revoked_at) throw new AppError('API key is already revoked', 400);

  await apiKeyRepository.revoke(keyId);
  auditService.log({ workspaceId: req.workspace.id, actorKeyId: req.apiKeyId, action: 'api_key.revoked', resourceType: 'api_key', resourceId: keyId });
  res.status(204).send();
});
