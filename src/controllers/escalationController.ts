import { Request, Response } from 'express';
import { escalationService } from '../services/escalationService';
import { auditService } from '../services/auditService';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { validateOrThrow } from '../validation';
import { z } from 'zod';

const ListEscalationsSchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const ResolveEscalationSchema = z.object({
  note: z.string().max(1000).optional(),
});

export const listEscalations = catchAsync(async (req: Request, res: Response) => {
  const parsed = validateOrThrow(ListEscalationsSchema, req.query);
  const status = (parsed.status ?? 'open') as 'open' | 'resolved' | 'all';
  const page = parsed.page ?? 1;
  const limit = parsed.limit ?? 20;
  const result = await escalationService.listEscalations(req.workspace.id, status, page, limit);
  sendSuccess(res, result);
});

export const resolveEscalation = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { note } = validateOrThrow(ResolveEscalationSchema, req.body);
  const query = await escalationService.resolve(id, req.workspace.id, note);
  auditService.log({
    workspaceId: req.workspace.id,
    actorKeyId: req.apiKeyId,
    action: 'escalation.resolved',
    resourceType: 'query',
    resourceId: id,
    meta: note ? { note } : {},
  });
  sendSuccess(res, query);
});
