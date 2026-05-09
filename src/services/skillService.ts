import { skillRepository } from '../repositories/skillRepository';
import { skillVersionRepository } from '../repositories/skillVersionRepository';
import { embeddingService } from './embeddingService';
import { AppError } from '../utils/AppError';
import { jaccardSimilarity } from '../utils/similarity';
import type { SkillRow } from '../types/entities';

const DUPLICATE_THRESHOLD = 0.75;

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateSkillInput {
  workspace_id: string;
  name: string;
  trigger_condition: string;
  decision: string;
  conditions?: Record<string, unknown> | null;
  escalation_required?: boolean;
  confidence?: number | null;
}

export interface UpdateSkillInput {
  name?: string;
  trigger_condition?: string;
  decision?: string;
  conditions?: Record<string, unknown> | null;
  escalation_required?: boolean;
  confidence?: number | null;
  // Audit attribution — pass req.apiKeyId from the controller
  changedBy?: string;
  changeNote?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateCreate(input: CreateSkillInput): void {
  if (!input.name?.trim()) throw new AppError('name is required', 400);
  if (!input.trigger_condition?.trim()) throw new AppError('trigger_condition is required', 400);
  if (!input.decision?.trim()) throw new AppError('decision is required', 400);
  validateConfidence(input.confidence);
}

function validateUpdate(input: UpdateSkillInput): void {
  if ('name' in input && !input.name?.trim()) throw new AppError('name cannot be empty', 400);
  if ('trigger_condition' in input && !input.trigger_condition?.trim()) {
    throw new AppError('trigger_condition cannot be empty', 400);
  }
  if ('decision' in input && !input.decision?.trim()) {
    throw new AppError('decision cannot be empty', 400);
  }
  validateConfidence(input.confidence);
}

function validateConfidence(value: number | null | undefined): void {
  if (value != null && (value < 0 || value > 1)) {
    throw new AppError('confidence must be between 0 and 1', 400);
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

async function assertNoDuplicate(
  workspaceId: string,
  triggerCondition: string,
  embedding: number[] | null,
  excludeId?: string
): Promise<void> {
  if (embedding) {
    // Vector-based dedup — catches semantic duplicates Jaccard misses
    const vectorDups = await skillRepository.findDuplicatesByVector(
      workspaceId,
      embedding,
      DUPLICATE_THRESHOLD,
      excludeId
    );
    if (vectorDups.length > 0) {
      const dup = vectorDups[0];
      throw new AppError(
        `A similar skill already exists: "${dup.name}" (${Math.round(dup.similarity * 100)}% semantic match on trigger_condition)`,
        409
      );
    }
    return;
  }

  // Fallback: Jaccard-based dedup when embedding is unavailable
  const existing = await skillRepository.findAllByWorkspace(workspaceId, 1, 200);
  for (const skill of existing) {
    if (excludeId && skill.id === excludeId) continue;
    if (!skill.trigger_condition) continue;

    const score = jaccardSimilarity(triggerCondition, skill.trigger_condition);
    if (score >= DUPLICATE_THRESHOLD) {
      throw new AppError(
        `A similar skill already exists: "${skill.name}" (${Math.round(score * 100)}% match on trigger_condition)`,
        409
      );
    }
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const skillService = {
  /**
   * Create a new skill. Always starts as pending_review — must be explicitly approved.
   */
  async create(input: CreateSkillInput): Promise<SkillRow> {
    validateCreate(input);

    const embedding = await embeddingService.embed(input.trigger_condition).catch(() => null);
    await assertNoDuplicate(input.workspace_id, input.trigger_condition, embedding);

    return skillRepository.create({
      workspace_id: input.workspace_id,
      name: input.name.trim(),
      trigger_condition: input.trigger_condition.trim(),
      decision: input.decision.trim(),
      conditions: input.conditions ?? null,
      escalation_required: input.escalation_required ?? false,
      confidence: input.confidence ?? null,
      status: 'pending_review',
      embedding,
    });
  },

  /**
   * Update a skill. Editing an active skill resets it to pending_review
   * so it must be re-approved before affecting the query engine.
   */
  async update(id: string, input: UpdateSkillInput): Promise<SkillRow> {
    validateUpdate(input);

    const existing = await skillRepository.findById(id);

    if (existing.status === 'disabled') {
      throw new AppError('Cannot update a disabled skill. Re-enable it first.', 400);
    }

    // Re-embed only if trigger_condition is changing
    let newEmbedding: number[] | null | undefined = undefined;
    if (input.trigger_condition && input.trigger_condition !== existing.trigger_condition) {
      newEmbedding = await embeddingService.embed(input.trigger_condition).catch(() => null);
      await assertNoDuplicate(existing.workspace_id, input.trigger_condition, newEmbedding, id);
    }

    // Editing an active skill requires re-approval
    const statusReset = existing.status === 'active'
      ? { status: 'pending_review' as const }
      : {};

    // Build patch — exclude undefined fields to avoid overwriting with null unintentionally
    const patch: Record<string, unknown> = { ...statusReset };
    const CONTENT_FIELDS = ['name', 'trigger_condition', 'decision', 'conditions', 'escalation_required', 'confidence'] as const;
    const hasContentChange = CONTENT_FIELDS.some(f => f in input && input[f] !== undefined);

    if (input.name !== undefined)                patch['name'] = input.name.trim();
    if (input.trigger_condition !== undefined)   patch['trigger_condition'] = input.trigger_condition.trim();
    if (input.decision !== undefined)            patch['decision'] = input.decision.trim();
    if (input.conditions !== undefined)          patch['conditions'] = input.conditions;
    if (input.escalation_required !== undefined) patch['escalation_required'] = input.escalation_required;
    if (input.confidence !== undefined)          patch['confidence'] = input.confidence;
    if (newEmbedding !== undefined)              patch['embedding'] = newEmbedding;

    const updated = await skillRepository.update(id, patch);

    // Write an immutable version snapshot for every content-field change
    if (hasContentChange) {
      const version = await skillVersionRepository.nextVersion(id);
      await skillVersionRepository.create({
        skill_id: id,
        workspace_id: updated.workspace_id,
        version,
        name: updated.name,
        trigger_condition: updated.trigger_condition,
        decision: updated.decision,
        conditions: updated.conditions,
        escalation_required: updated.escalation_required,
        confidence: updated.confidence,
        status: updated.status,
        changed_by: input.changedBy ?? 'system',
        change_note: input.changeNote ?? null,
      }).catch(() => {}); // version write failure must not block the main response

      return updated;
    }

    return updated;
  },

  /**
   * Approve a pending_review skill — makes it active and visible to the query engine.
   */
  async approve(id: string): Promise<SkillRow> {
    const skill = await skillRepository.findById(id);

    if (skill.status === 'active') {
      throw new AppError('Skill is already active', 400);
    }

    if (skill.status === 'disabled') {
      throw new AppError('Cannot approve a disabled skill. Re-enable it first.', 400);
    }

    return skillRepository.update(id, { status: 'active' });
  },

  /**
   * Disable a skill — removes it from the query engine without deleting it.
   */
  async disable(id: string): Promise<SkillRow> {
    const skill = await skillRepository.findById(id);

    if (skill.status === 'disabled') {
      throw new AppError('Skill is already disabled', 400);
    }

    return skillRepository.update(id, { status: 'disabled' });
  },

  /**
   * Returns only active skills. These are the only ones the query engine should use.
   */
  async getActiveForWorkspace(workspaceId: string, page = 1, limit = 20): Promise<SkillRow[]> {
    return skillRepository.findAllByWorkspace(workspaceId, page, limit, 'active');
  },

  /**
   * Re-enable a disabled skill — resets to pending_review for re-approval.
   */
  async enable(id: string): Promise<SkillRow> {
    const skill = await skillRepository.findById(id);

    if (skill.status !== 'disabled') {
      throw new AppError('Skill is not disabled', 400);
    }

    return skillRepository.update(id, { status: 'pending_review' });
  },

  /**
   * Assert that a skill belongs to the given workspace.
   * Throws 404 (not 403) to avoid ID enumeration across tenants.
   */
  async assertOwnership(skillId: string, workspaceId: string): Promise<SkillRow> {
    const skill = await skillRepository.findById(skillId);
    if (skill.workspace_id !== workspaceId) {
      throw new AppError('Skill not found', 404);
    }
    return skill;
  },

  async getById(id: string): Promise<SkillRow> {
    return skillRepository.findById(id);
  },

  async getAllForWorkspace(workspaceId: string, page = 1, limit = 20): Promise<SkillRow[]> {
    return skillRepository.findAllByWorkspace(workspaceId, page, limit);
  },

  async deleteSkill(id: string): Promise<void> {
    return skillRepository.delete(id);
  },
};
