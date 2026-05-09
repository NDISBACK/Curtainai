import { Request, Response } from 'express';
import { teamService } from '../services/teamService';
import { auditService } from '../services/auditService';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { validateOrThrow } from '../validation';
import { z } from 'zod';

const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  name: z.string().max(100).optional(),
});

const UpdateMemberSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  name: z.string().max(100).optional(),
});

export const listTeam = catchAsync(async (req: Request, res: Response) => {
  const members = await teamService.list(req.workspace.id);
  sendSuccess(res, members);
});

export const addMember = catchAsync(async (req: Request, res: Response) => {
  const { email, role = 'viewer', name } = validateOrThrow(AddMemberSchema, req.body);
  const member = await teamService.add(req.workspace.id, email, role as 'admin' | 'editor' | 'viewer', name, req.apiKeyId);
  auditService.log({
    workspaceId: req.workspace.id,
    actorKeyId: req.apiKeyId,
    action: 'member.added',
    resourceType: 'member',
    resourceId: member.id,
    meta: { email, role },
  });
  sendSuccess(res, member, 201);
});

export const updateMember = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id?.trim()) throw new AppError('member id is required', 400);
  const { role, name } = validateOrThrow(UpdateMemberSchema, req.body);
  if (role === undefined && name === undefined) throw new AppError('No fields to update', 400);
  const member = await teamService.updateRole(id, req.workspace.id, role!, name);
  auditService.log({
    workspaceId: req.workspace.id,
    actorKeyId: req.apiKeyId,
    action: 'member.updated',
    resourceType: 'member',
    resourceId: id,
    meta: { role, name },
  });
  sendSuccess(res, member);
});

export const removeMember = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id?.trim()) throw new AppError('member id is required', 400);
  await teamService.remove(id, req.workspace.id);
  auditService.log({
    workspaceId: req.workspace.id,
    actorKeyId: req.apiKeyId,
    action: 'member.removed',
    resourceType: 'member',
    resourceId: id,
  });
  res.status(204).send();
});
