import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { WorkspaceMemberRow, InsertWorkspaceMember, UpdateWorkspaceMember } from '../types/entities';

export class TeamRepository extends BaseRepository {
  protected readonly table = 'workspace_members';

  async findAllByWorkspace(workspaceId: string): Promise<WorkspaceMemberRow[]> {
    const { data, error } = await this.from()
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as WorkspaceMemberRow[];
  }

  async findById(id: string): Promise<WorkspaceMemberRow> {
    const { data, error } = await this.from()
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    return data as WorkspaceMemberRow;
  }

  async create(payload: InsertWorkspaceMember): Promise<WorkspaceMemberRow> {
    const { data, error } = await this.from()
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new AppError('Member already exists in this workspace', 409);
      throw new AppError(error.message, 500);
    }
    return data as WorkspaceMemberRow;
  }

  async update(id: string, patch: UpdateWorkspaceMember): Promise<WorkspaceMemberRow> {
    const { data, error } = await this.from()
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    return data as WorkspaceMemberRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.from().delete().eq('id', id);
    if (error) throw new AppError(error.message, 500);
  }
}

export const teamRepository = new TeamRepository();
