import { Request, Response } from 'express';
import { extractionService } from '../services/extractionService';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { validateOrThrow } from '../validation';
import { ExtractConversationSchema } from '../validation/extraction.schema';

export const extractSkills = catchAsync(async (req: Request, res: Response) => {
  const { conversation } = validateOrThrow(ExtractConversationSchema, req.body);
  const result = await extractionService.extractFromConversation(conversation);
  sendSuccess(res, result, 200);
});
