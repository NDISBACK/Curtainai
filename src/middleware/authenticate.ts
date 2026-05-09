import { Request, Response, NextFunction } from 'express';
import { hashApiKey } from '../utils/apiKey';
import { apiKeyRepository } from '../repositories/apiKeyRepository';
import { workspaceRepository } from '../repositories/workspaceRepository';
import { AppError } from '../utils/AppError';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Missing or invalid Authorization header', 401));
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    return next(new AppError('Missing or invalid Authorization header', 401));
  }

  const hash = hashApiKey(rawKey);
  const apiKey = await apiKeyRepository.findByHash(hash).catch(() => null);

  if (!apiKey || apiKey.revoked_at) {
    return next(new AppError('Invalid or revoked API key', 401));
  }
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return next(new AppError('API key has expired', 401));
  }

  const workspace = await workspaceRepository.findById(apiKey.workspace_id);
  req.workspace = workspace;
  req.apiKeyId = apiKey.id;
  req.apiKeyScope = apiKey.scope ?? 'full';

  // Fire-and-forget — do not delay the request
  apiKeyRepository.touchLastUsed(apiKey.id).catch(() => {});

  next();
}
