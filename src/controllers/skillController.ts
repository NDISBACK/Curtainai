import { Request, Response } from 'express';
import { skillService } from '../services/skillService';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { validateOrThrow } from '../validation';
import { CreateSkillSchema, UpdateSkillSchema, ListSkillsQuerySchema } from '../validation/skill.schema';

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
    workspace_id: req.workspace.id,  // always from auth context, not body
  });
  const skill = await skillService.create(input);
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
  res.status(204).send();
});

export const approveSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await skillService.assertOwnership(id, req.workspace.id);
  const skill = await skillService.approve(id);
  sendSuccess(res, skill);
});

export const disableSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await skillService.assertOwnership(id, req.workspace.id);
  const skill = await skillService.disable(id);
  sendSuccess(res, skill);
});

export const enableSkill = catchAsync(async (req: Request, res: Response) => {
  const id = requireId(req);
  await skillService.assertOwnership(id, req.workspace.id);
  const skill = await skillService.enable(id);
  sendSuccess(res, skill);
});

export const listSkills = catchAsync(async (req: Request, res: Response) => {
  const { status, page, limit } = validateOrThrow(ListSkillsQuerySchema, req.query);
  const workspaceId = req.workspace.id;

  const skills = status === 'active'
    ? await skillService.getActiveForWorkspace(workspaceId, page, limit)
    : await skillService.getAllForWorkspace(workspaceId, page, limit);

  sendSuccess(res, skills);
});
