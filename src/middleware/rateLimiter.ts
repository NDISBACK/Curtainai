import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

// In-memory sliding window — single-process only.
// For multi-instance deployments, replace with a Redis-backed implementation (e.g. ioredis).
const windows = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;  // 1 minute
const MAX_REQUESTS = 100;  // per workspace per minute

export function rateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const key = req.workspace?.id ?? req.ip ?? 'unknown';
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return next(new AppError('Rate limit exceeded', 429));
  }

  next();
}
