import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { SkillRow, InsertSkill, UpdateSkill, SkillStatus } from '../types/entities';

const DEFAULT_LIMIT = 20;

export class SkillRepository extends BaseRepository {
  protected readonly table = 'skills';

  async findById(id: string): Promise<SkillRow> {
    const { data, error } = await this.from()
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    }

    return data as SkillRow;
  }

  async findAllByWorkspace(
    workspaceId: string,
    page = 1,
    limit = DEFAULT_LIMIT,
    status?: SkillStatus
  ): Promise<SkillRow[]> {
    const offset = (page - 1) * limit;

    let query = this.from()
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== undefined) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500);

    return (data ?? []) as SkillRow[];
  }

  async create(payload: InsertSkill): Promise<SkillRow> {
    const { data, error } = await this.from()
      .insert(payload)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    return data as SkillRow;
  }

  async update(id: string, payload: UpdateSkill): Promise<SkillRow> {
    const { data, error } = await this.from()
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    }

    return data as SkillRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.from().delete().eq('id', id);

    if (error) throw new AppError(error.message, 500);
  }

  async findByVectorSimilarity(
    workspaceId: string,
    embedding: number[],
    topK: number,
    minScore = 0.0
  ): Promise<Array<SkillRow & { vector_score: number }>> {
    const { data, error } = await this.db.rpc('match_skills_vector', {
      p_workspace_id: workspaceId,
      p_embedding: embedding,
      p_top_k: topK,
      p_min_score: minScore,
    });

    if (error) throw new AppError(error.message, 500);

    return (data ?? []) as Array<SkillRow & { vector_score: number }>;
  }

  async findDuplicatesByVector(
    workspaceId: string,
    embedding: number[],
    threshold: number,
    excludeId?: string
  ): Promise<Array<{ id: string; name: string; similarity: number }>> {
    const { data, error } = await this.db.rpc('find_duplicate_skills', {
      p_workspace_id: workspaceId,
      p_embedding: embedding,
      p_threshold: threshold,
      p_exclude_id: excludeId ?? null,
    });

    if (error) throw new AppError(error.message, 500);

    return (data ?? []) as Array<{ id: string; name: string; similarity: number }>;
  }
}

export const skillRepository = new SkillRepository();
