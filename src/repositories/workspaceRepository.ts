import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { WorkspaceRow, InsertWorkspace, UpdateWorkspace } from '../types/entities';

const DEFAULT_LIMIT = 20;

export class WorkspaceRepository extends BaseRepository {
  protected readonly table = 'workspaces';

  async findById(id: string): Promise<WorkspaceRow> {
    const { data, error } = await this.from()
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    }

    return data as WorkspaceRow;
  }

  async findAll(page = 1, limit = DEFAULT_LIMIT): Promise<WorkspaceRow[]> {
    const offset = (page - 1) * limit;

    const { data, error } = await this.from()
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new AppError(error.message, 500);

    return (data ?? []) as WorkspaceRow[];
  }

  async create(payload: InsertWorkspace): Promise<WorkspaceRow> {
    const { data, error } = await this.from()
      .insert(payload)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    return data as WorkspaceRow;
  }

  async update(id: string, payload: UpdateWorkspace): Promise<WorkspaceRow> {
    const { data, error } = await this.from()
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    }

    return data as WorkspaceRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.from().delete().eq('id', id);

    if (error) throw new AppError(error.message, 500);
  }
}

export const workspaceRepository = new WorkspaceRepository();
