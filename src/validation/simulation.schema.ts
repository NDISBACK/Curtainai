import { z } from 'zod';

// ─── Simulation skill ─────────────────────────────────────────────────────────
// Represents a modified or new skill to test against historical queries.
// If `id` matches an existing active skill, that skill is replaced.
// If `id` is omitted or doesn't match, the skill is added as a new entry.

export const SimulationSkillSchema = z.object({
  id: z.string().uuid('id must be a valid UUID').optional(),
  name: z.string().min(1, 'name is required').max(200),
  trigger_condition: z.string().min(1, 'trigger_condition is required').max(2000),
  decision: z.string().min(1, 'decision is required').max(2000),
  conditions: z.record(z.unknown()).nullable().default(null),
  escalation_required: z.boolean().default(false),
  confidence: z.number().min(0).max(1).nullable().default(null),
});

// ─── Simulation request ───────────────────────────────────────────────────────

export const SimulationRequestSchema = z.object({
  // Skills to test — these replace or supplement the current active set
  simulation_skills: z
    .array(SimulationSkillSchema)
    .min(1, 'At least one simulation skill is required')
    .max(50, 'Maximum 50 simulation skills allowed'),

  // Optional: specific query IDs to test against.
  // If omitted, the most recent `sample_size` queries are used.
  query_ids: z
    .array(z.string().uuid())
    .max(500, 'Maximum 500 query IDs')
    .optional(),

  // How many recent queries to sample when query_ids is not provided
  sample_size: z
    .number()
    .int()
    .min(1)
    .max(500, 'Maximum sample size is 500')
    .optional()
    .default(100),
});

// Explicit output types — Zod's z.infer conflates input/output when .default() is used,
// so we define these manually to match what parse() actually returns.
export type SimulationSkillInput = {
  id?: string;
  name: string;
  trigger_condition: string;
  decision: string;
  conditions: Record<string, unknown> | null;
  escalation_required: boolean;
  confidence: number | null;
};

export type SimulationRequest = {
  simulation_skills: SimulationSkillInput[];
  query_ids?: string[];
  sample_size: number;
};
