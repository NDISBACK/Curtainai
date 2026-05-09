import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { IntegrationRow, InsertIntegration, UpdateIntegration } from '../types/entities';

export class IntegrationRepository extends BaseRepository {
  protected readonly table = 'integrations';

  async findById(id: string): Promise<IntegrationRow> {
    const { data, error } = await this.from()
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    return data as IntegrationRow;
  }

  async findAllByWorkspace(workspaceId: string): Promise<IntegrationRow[]> {
    const { data, error } = await this.from()
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as IntegrationRow[];
  }

  async findByWorkspaceAndProvider(
    workspaceId: string,
    provider: string
  ): Promise<IntegrationRow | null> {
    const { data, error } = await this.from()
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', provider)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    return data as IntegrationRow | null;
  }

  async upsert(payload: InsertIntegration): Promise<IntegrationRow> {
    const { data, error } = await this.from()
      .upsert(payload, { onConflict: 'workspace_id,provider' })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return data as IntegrationRow;
  }

  async update(id: string, payload: UpdateIntegration): Promise<IntegrationRow> {
    const { data, error } = await this.from()
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    return data as IntegrationRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.from().delete().eq('id', id);
    if (error) throw new AppError(error.message, 500);
  }

  async touchLastSynced(id: string): Promise<void> {
    const { error } = await this.from()
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new AppError(error.message, 500);
  }
}

export const integrationRepository = new IntegrationRepository();
