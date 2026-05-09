import { Request, Response } from 'express';
import { skillService } from '../services/skillService';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { validateOrThrow } from '../validation';
import { CreateSkillSchema, UpdateSkillSchema, ListSkillsQuerySchema, BatchApproveSchema } from '../validation/skill.schema';
import { auditService } from '../services/auditService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireId(req: Request): string {
  const { id } = req.params;
  if (!id?.trim()) throw new AppError('skill id is required', 400);
  return id;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export const createSkill = catchAsync(async (req: Request, res: Response) => {
  const input = validateOrThrow(CreateSkillSchema, {
    ...req.body,
    workspace_id: req.workspace.id,
  });
  const skill = await skillService.create(input);
  auditService.log({ workspaceId: req.workspace.id, actorKeyId: req.apiKeyId, action: 'skill.created', resourceType: 'skill', resourceId: skill.id, meta: { name: skill.name } });
  sendSuccess(res, skill, 201);
});

export const getSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  const skill = await skillService.assertOwnership(id, req.workspace.id);
  sendSuccess(res, skill);
});

export const updateSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await skillService.assertOwnership(id, req.workspace.id);
  const input = validateOrThrow(UpdateSkillSchema, req.body);
  const updated = await skillService.update(id, { ...input, changedBy: req.apiKeyId });
  sendSuccess(res, updated);
});

export const deleteSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await skillService.assertOwnership(id, req.workspace.id);
  await skillService.deleteSkill(id);
  auditService.log({ workspaceId: req.workspace.id, actorKeyId: req.apiKeyId, action: 'skill.deleted', resourceType: 'skill', resourceId: id });
  res.status(204).send();
});

export const approveSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await skillService.assertOwnership(id, req.workspace.id);
  const { skill, conflicts } = await skillService.approve(id);
  auditService.log({ workspaceId: req.workspace.id, actorKeyId: req.apiKeyId, action: 'skill.approved', resourceType: 'skill', resourceId: id });
  sendSuccess(res, { skill, conflicts });
});

export const batchApproveSkills = catchAsync(async (req: Request, res: Response) => {
  const { ids } = validateOrThrow(BatchApproveSchema, req.body);
  const result = await skillService.batchApprove(ids, req.workspace.id);
  auditService.log({ workspaceId: req.workspace.id, actorKeyId: req.apiKeyId, action: 'skill.batch_approved', meta: { count: result.approved.length } });
  sendSuccess(res, result);
});

export const disableSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await skillService.assertOwnership(id, req.workspace.id);
  const skill = await skillService.disable(id);
  auditService.log({ workspaceId: req.workspace.id, actorKeyId: req.apiKeyId, action: 'skill.disabled', resourceType: 'skill', resourceId: id });
  sendSuccess(res, skill);
});

export const enableSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await skillService.assertOwnership(id, req.workspace.id);
  const skill = await skillService.enable(id);
  sendSuccess(res, skill);
});

export const listSkills = catchAsync(async (req: Request, res: Response) => {
  const { status, page, limit, search } = validateOrThrow(ListSkillsQuerySchema, req.query);
  const workspaceId = req.workspace.id;

  let skills;
  if (search?.trim()) {
    skills = await skillService.searchForWorkspace(workspaceId, search, page, limit);
  } else if (status === 'active') {
    skills = await skillService.getActiveForWorkspace(workspaceId, page, limit);
  } else {
    skills = await skillService.getAllForWorkspace(workspaceId, page, limit);
  }

  sendSuccess(res, skills);
});
