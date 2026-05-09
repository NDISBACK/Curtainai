import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { ApiKeyRow, InsertApiKey } from '../types/entities';

export class ApiKeyRepository extends BaseRepository {
  protected readonly table = 'api_keys';

  async findByHash(hash: string): Promise<ApiKeyRow | null> {
    const { data, error } = await this.from()
      .select('*')
      .eq('key_hash', hash)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);

    return data as ApiKeyRow | null;
  }

  async findAllByWorkspace(workspaceId: string): Promise<ApiKeyRow[]> {
    const { data, error } = await this.from()
      .select('id, workspace_id, key_prefix, name, last_used_at, expires_at, created_at, revoked_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);

    return (data ?? []) as ApiKeyRow[];
  }

  async create(payload: InsertApiKey): Promise<ApiKeyRow> {
    const { data, error } = await this.from()
      .insert(payload)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    return data as ApiKeyRow;
  }

  async revoke(id: string): Promise<void> {
    const { error } = await this.from()
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new AppError(error.message, 500);
  }

  async touchLastUsed(id: string): Promise<void> {
    const { error } = await this.from()
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new AppError(error.message, 500);
  }
}

export const apiKeyRepository = new ApiKeyRepository();
