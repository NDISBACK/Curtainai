import { Request, Response } from 'express';
import { healthService } from '../services/healthService';
import { sendSuccess } from '../utils/response';

export const getHealth = (_req: Request, res: Response): void => {
  sendSuccess(res, healthService.check());
};
