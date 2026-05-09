import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { SkillVersionRow, InsertSkillVersion } from '../types/entities';

export class SkillVersionRepository extends BaseRepository {
  protected readonly table = 'skill_versions';

  async create(payload: InsertSkillVersion): Promise<SkillVersionRow> {
    const { data, error } = await this.from()
      .insert(payload)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    return data as SkillVersionRow;
  }

  async findBySkillId(skillId: string): Promise<SkillVersionRow[]> {
    const { data, error } = await this.from()
      .select('*')
      .eq('skill_id', skillId)
      .order('version', { ascending: false });

    if (error) throw new AppError(error.message, 500);

    return (data ?? []) as SkillVersionRow[];
  }

  async findBySkillIdAndVersion(skillId: string, version: number): Promise<SkillVersionRow> {
    const { data, error } = await this.from()
      .select('*')
      .eq('skill_id', skillId)
      .eq('version', version)
      .single();

    if (error) {
      throw new AppError(error.message, error.code === 'PGRST116' ? 404 : 500);
    }

    return data as SkillVersionRow;
  }

  async nextVersion(skillId: string): Promise<number> {
    const { data, error } = await this.from()
      .select('version')
      .eq('skill_id', skillId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);

    return data ? (data as { version: number }).version + 1 : 1;
  }
}

export const skillVersionRepository = new SkillVersionRepository();
