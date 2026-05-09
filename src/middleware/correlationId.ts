import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
}
