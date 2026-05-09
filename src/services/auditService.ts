import { auditRepository } from '../repositories/auditRepository';
import { logger } from '../utils/logger';

export type AuditAction =
  | 'skill.created' | 'skill.updated' | 'skill.approved' | 'skill.disabled'
  | 'skill.enabled' | 'skill.deleted' | 'skill.batch_approved'
  | 'api_key.created' | 'api_key.revoked'
  | 'member.added' | 'member.updated' | 'member.removed'
  | 'workspace.updated'
  | 'escalation.resolved';

export interface AuditParams {
  workspaceId: string;
  actorKeyId?: string | null;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
}

export const auditService = {
  // Fire-and-forget — never blocks the main request
  log(params: AuditParams): void {
    auditRepository.create({
      workspace_id: params.workspaceId,
      actor_key_id: params.actorKeyId ?? null,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      meta: params.meta ?? {},
    }).catch(err => {
      logger.warn('audit.write_failed', { action: params.action, error: String(err) });
    });
  },
};
