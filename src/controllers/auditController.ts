import { Request, Response } from 'express';
import { auditRepository } from '../repositories/auditRepository';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { validateOrThrow } from '../validation';
import { z } from 'zod';

const ListAuditSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  resource_type: z.string().optional(),
});

export const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, resource_type } = validateOrThrow(ListAuditSchema, req.query);
  const result = await auditRepository.findByWorkspace(req.workspace.id, page, limit, resource_type);
  sendSuccess(res, result);
});
