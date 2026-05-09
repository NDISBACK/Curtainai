import { skillService } from './skillService';
import { AppError } from '../utils/AppError';

export interface ImportSkillPayload {
  name: string;
  trigger_condition: string;
  decision: string;
  conditions?: Record<string, unknown> | null;
  escalation_required?: boolean;
  confidence?: number | null;
}

export interface ImportResult {
  created: number;
  skipped_duplicates: number;
  errors: Array<{ index: number; name: string; message: string }>;
}

export const importService = {
  async importSkills(
    workspaceId: string,
    skills: ImportSkillPayload[]
  ): Promise<ImportResult> {
    let created = 0;
    let skipped_duplicates = 0;
    const errors: ImportResult['errors'] = [];

    for (let i = 0; i < skills.length; i++) {
      const payload = skills[i];
      try {
        await skillService.create({
          workspace_id: workspaceId,
          name: payload.name,
          trigger_condition: payload.trigger_condition,
          decision: payload.decision,
          conditions: payload.conditions ?? null,
          escalation_required: payload.escalation_required ?? false,
          confidence: payload.confidence ?? null,
        });
        created++;
      } catch (err) {
        if (err instanceof AppError && err.statusCode === 409) {
          skipped_duplicates++;
        } else {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ index: i, name: payload.name ?? `[${i}]`, message });
        }
      }
    }

    return { created, skipped_duplicates, errors };
  },
};
