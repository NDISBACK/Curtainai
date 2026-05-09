import { BaseRepository } from './baseRepository';
import { AppError } from '../utils/AppError';
import type { AuditLogRow, InsertAuditLog } from '../types/entities';

const DEFAULT_LIMIT = 50;

export class AuditRepository extends BaseRepository {
  protected readonly table = 'audit_logs';

  async create(payload: InsertAuditLog): Promise<AuditLogRow> {
    const { data, error } = await this.from()
      .insert(payload)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return data as AuditLogRow;
  }

  async findByWorkspace(
    workspaceId: string,
    page = 1,
    limit = DEFAULT_LIMIT,
    resourceType?: string
  ): Promise<{ data: AuditLogRow[]; total: number }> {
    const offset = (page - 1) * limit;

    let query = this.from()
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (resourceType) query = query.eq('resource_type', resourceType);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw new AppError(error.message, 500);
    return { data: (data ?? []) as AuditLogRow[], total: count ?? 0 };
  }
}

export const auditRepository = new AuditRepository();
