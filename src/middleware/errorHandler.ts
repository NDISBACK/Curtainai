import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

interface ErrorBody {
  success: false;
  error: string;
  correlation_id?: string;
  stack?: string;
}

export const notFound = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError('Route not found', 404));
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError && err.isOperational ? err.message : 'Internal server error';

  if (!env.isDev && statusCode === 500) {
    console.error('[UNHANDLED ERROR]', err);
  }

  const body: ErrorBody = {
    success: false,
    error: message,
    correlation_id: req.correlationId,
  };

  if (env.isDev) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};
