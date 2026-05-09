import { Response } from 'express';
import { ApiResponse } from '../types';

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200, message?: string): void => {
  const payload: ApiResponse<T> = { success: true, data, message };
  res.status(statusCode).json(payload);
};

export const sendError = (res: Response, message: string, statusCode = 500): void => {
  const payload: ApiResponse = { success: false, error: message };
  res.status(statusCode).json(payload);
};
