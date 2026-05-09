import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { OverrideRow, InsertOverride } from '../types/entities';

export class OverrideRepository extends BaseRepository {
  protected readonly table = 'overrides';

  async findById(id: string): Promise<OverrideRow> {
    const { data, error } = await this.from()
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    }

    return data as OverrideRow;
  }

  async findByQueryId(queryId: string): Promise<OverrideRow[]> {
    const { data, error } = await this.from()
      .select('*')
      .eq('query_id', queryId)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);

    return (data ?? []) as OverrideRow[];
  }

  async create(payload: InsertOverride): Promise<OverrideRow> {
    const { data, error } = await this.from()
      .insert(payload)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    return data as OverrideRow;
  }
}

export const overrideRepository = new OverrideRepository();
