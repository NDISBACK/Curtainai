import { Request, Response } from 'express';
import { queryService } from '../services/queryService';
import { overrideService } from '../services/overrideService';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { validateOrThrow } from '../validation';
import { RunQuerySchema, SubmitOverrideSchema } from '../validation/query.schema';

export const runQuery = catchAsync(async (req: Request, res: Response) => {
  const { query } = validateOrThrow(RunQuerySchema, req.body);
  const result = await queryService.run({
    query,
    workspace_id: req.workspace.id,  // always from auth context
    workspace: req.workspace,
  });
  sendSuccess(res, result);
});

export const submitOverride = catchAsync(async (req: Request, res: Response) => {
  const input = validateOrThrow(SubmitOverrideSchema, req.body);
  const result = await overrideService.submit(input);
  sendSuccess(res, result, 201);
});
