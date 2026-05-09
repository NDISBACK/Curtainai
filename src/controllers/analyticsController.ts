import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import { skillService } from '../services/skillService';
import { queryRepository } from '../repositories/queryRepository';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { validateOrThrow } from '../validation';
import { DateRangeSchema, QueryHistorySchema } from '../validation/analytics.schema';

export const getWorkspaceAnalytics = catchAsync(async (req: Request, res: Response) => {
  if (req.params['id'] && req.params['id'] !== req.workspace.id) {
    throw new AppError('Workspace not found', 404);
  }
  const { from, to } = validateOrThrow(DateRangeSchema, req.query);
  const analytics = await analyticsService.getWorkspaceAnalytics(
    req.workspace.id,
    from ? new Date(from) : undefined,
    to   ? new Date(to)   : undefined
  );
  sendSuccess(res, analytics);
});

export const getSkillAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id?.trim()) throw new AppError('skill id is required', 400);

  await skillService.assertOwnership(id, req.workspace.id);

  const { from, to } = validateOrThrow(DateRangeSchema, req.query);
  const analytics = await analyticsService.getSkillAnalytics(
    id,
    from ? new Date(from) : undefined,
    to   ? new Date(to)   : undefined
  );
  sendSuccess(res, analytics);
});

export const getQueryHistory = catchAsync(async (req: Request, res: Response) => {
  const parsed = validateOrThrow(QueryHistorySchema, req.query);
  const { data, total } = await queryRepository.findWithFilters(
    req.workspace.id,
    {
      from:      parsed.from      ? new Date(parsed.from) : undefined,
      to:        parsed.to        ? new Date(parsed.to)   : undefined,
      escalated: parsed.escalated as boolean | undefined,
      skillId:   parsed.skill_id,
    },
    parsed.page,
    parsed.limit
  );
  sendSuccess(res, { data, total, page: parsed.page, limit: parsed.limit });
});
