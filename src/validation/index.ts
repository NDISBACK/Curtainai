import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown, statusCode = 400): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new AppError(msg, statusCode);
  }
  return result.data;
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = validateOrThrow(schema, req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}
