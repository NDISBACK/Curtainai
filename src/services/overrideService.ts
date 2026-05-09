import { overrideRepository } from '../repositories/overrideRepository';
import { queryRepository } from '../repositories/queryRepository';
import { skillService } from './skillService';
import { extractionService } from './extractionService';
import { AppError } from '../utils/AppError';
import type { OverrideRow, SkillRow } from '../types/entities';

// ─── Exported types ───────────────────────────────────────────────────────────

export interface SubmitOverrideInput {
  query_id: string;
  corrected_decision: string;
}

export interface OverrideResult {
  override: OverrideRow;
  generated_skills: SkillRow[];
  skipped_duplicates: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSyntheticConversation(userInput: string, correctedDecision: string): string {
  // Minimal two-turn exchange — enough for the extraction engine to derive a skill pattern
  return `Customer: ${userInput}\nAgent: ${correctedDecision}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const overrideService = {
  /**
   * Submit a human correction for a query.
   * Stores the override, then uses it to generate a new pending_review skill
   * so the system can learn from the correction.
   */
  async submit(input: SubmitOverrideInput): Promise<OverrideResult> {
    if (!input.query_id?.trim()) throw new AppError('query_id is required', 400);
    if (!input.corrected_decision?.trim()) throw new AppError('corrected_decision is required', 400);

    // Fetch the original query — needed for workspace_id and the original user input
    const query = await queryRepository.findById(input.query_id);

    // Log the override — immutable record of the human correction
    const override = await overrideRepository.create({
      query_id: input.query_id,
      corrected_decision: input.corrected_decision.trim(),
    });

    // Build a minimal synthetic conversation from the original input + human correction,
    // then extract a skill pattern from it via the LLM
    const conversation = buildSyntheticConversation(query.input, input.corrected_decision);
    const extraction = await extractionService.extractFromConversation(conversation);

    const generatedSkills: SkillRow[] = [];
    let skippedDuplicates = 0;

    for (const extracted of extraction.skills) {
      try {
        const skill = await skillService.create({
          workspace_id: query.workspace_id,
          name: extracted.name,
          trigger_condition: extracted.trigger_condition,
          decision: extracted.decision,
          // Convert string[] → Record so it fits the DB's JSONB conditions column
          conditions: extracted.conditions.length > 0 ? { items: extracted.conditions } : null,
          escalation_required: extracted.escalation_required,
          confidence: extracted.confidence,
        });
        generatedSkills.push(skill);
      } catch (err) {
        if (err instanceof AppError && err.statusCode === 409) {
          // A similar skill already exists — skip silently, don't fail the override
          skippedDuplicates++;
        } else {
          throw err;
        }
      }
    }

    return { override, generated_skills: generatedSkills, skipped_duplicates: skippedDuplicates };
  },

  async getByQueryId(queryId: string): Promise<OverrideRow[]> {
    return overrideRepository.findByQueryId(queryId);
  },
};
