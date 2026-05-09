import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { QueryRow, InsertQuery } from '../types/entities';

const DEFAULT_LIMIT = 20;

export interface QueryFilter {
  from?: Date;
  to?: Date;
  escalated?: boolean;
  skillId?: string;
}

export class QueryRepository extends BaseRepository {
  protected readonly table = 'queries';

  async findById(id: string): Promise<QueryRow> {
    const { data, error } = await this.from()
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    }

    return data as QueryRow;
  }

  async findAllByWorkspace(
    workspaceId: string,
    page = 1,
    limit = DEFAULT_LIMIT
  ): Promise<QueryRow[]> {
    const offset = (page - 1) * limit;

    const { data, error } = await this.from()
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new AppError(error.message, 500);

    return (data ?? []) as QueryRow[];
  }

  async findWithFilters(
    workspaceId: string,
    filter: QueryFilter,
    page = 1,
    limit = DEFAULT_LIMIT
  ): Promise<{ data: QueryRow[]; total: number }> {
    const offset = (page - 1) * limit;

    let query = this.from()
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (filter.from)     query = query.gte('created_at', filter.from.toISOString());
    if (filter.to)       query = query.lte('created_at', filter.to.toISOString());
    if (filter.escalated !== undefined) query = query.eq('escalated', filter.escalated);
    if (filter.skillId)  query = query.eq('matched_skill_id', filter.skillId);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw new AppError(error.message, 500);

    return { data: (data ?? []) as QueryRow[], total: count ?? 0 };
  }

  async findManyByIds(ids: string[], workspaceId: string): Promise<QueryRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.from()
      .select('*')
      .in('id', ids)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as QueryRow[];
  }

  async create(payload: InsertQuery): Promise<QueryRow> {
    const { data, error } = await this.from()
      .insert(payload)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    return data as QueryRow;
  }

  async resolveEscalation(id: string, workspaceId: string, note?: string): Promise<QueryRow> {
    const { data, error } = await this.from()
      .update({ escalation_status: 'resolved', resolved_at: new Date().toISOString(), resolved_note: note ?? null })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .eq('escalated', true)
      .select()
      .single();

    if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    return data as QueryRow;
  }

  async findEscalated(
    workspaceId: string,
    status: 'open' | 'resolved' | 'all',
    page = 1,
    limit = 20
  ): Promise<{ data: QueryRow[]; total: number }> {
    const offset = (page - 1) * limit;
    let query = this.from()
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('escalated', true)
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('escalation_status', status);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw new AppError(error.message, 500);
    return { data: (data ?? []) as QueryRow[], total: count ?? 0 };
  }
}

export const queryRepository = new QueryRepository();
