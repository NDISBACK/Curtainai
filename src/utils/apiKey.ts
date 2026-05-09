import { createHash, randomBytes } from 'crypto';

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = 'cai_' + randomBytes(32).toString('hex'); // "cai_" + 64 hex chars = 68 total
  const hash = createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 8); // "cai_xxxx"
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
