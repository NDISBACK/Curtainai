import crypto from 'crypto';
import { integrationRepository } from '../repositories/integrationRepository';
import { extractionService, type ExtractedSkill } from './extractionService';
import { jaccardSimilarity } from '../utils/similarity';
import { skillService } from './skillService';
import { gmailService } from './gmailService';
import { whatsappService, type WhatsAppConfig } from './whatsappService';
import { freshdeskService, type FreshdeskConfig } from './freshdeskService';
import { CONFIG_SCHEMAS } from '../validation/integration.schema';
import { AppError } from '../utils/AppError';
import type { IntegrationRow, IntegrationProvider, SkillRow } from '../types/entities';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface SyncPreview {
  integration_id:  string;
  provider:        IntegrationProvider;
  items_fetched:   number;
  extracted_skills: ExtractedSkill[];
  errors:          string[];
}

export interface ConfirmResult {
  skills_created: number;
  skills_skipped: number;
  created_skills: SkillRow[];
  errors:         string[];
}

// ─── In-memory job queue ──────────────────────────────────────────────────────

export type SyncJobStatus = 'running' | 'done' | 'error' | 'cancelled';

export interface SyncProgress {
  fetched: number;  // threads retrieved from provider
  total:   number;  // total threads to process
  done:    number;  // threads extraction-complete
}

export interface SyncJob {
  id:             string;
  integration_id: string;
  workspace_id:   string;
  status:         SyncJobStatus;
  progress:       SyncProgress;
  cancelled:      boolean;
  result?:        SyncPreview;
  error?:         string;
  created_at:     number;
}

const syncJobs = new Map<string, SyncJob>();
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry an async fn up to maxAttempts times, backing off on 429s
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 10_000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err instanceof AppError && err.statusCode === 429;
      if (!is429 || attempt === maxAttempts) throw err;
      // Exponential backoff: 10s, 20s, 40s
      await sleep(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }
  throw new Error('unreachable');
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const integrationService = {

  async listForWorkspace(workspaceId: string): Promise<IntegrationRow[]> {
    return integrationRepository.findAllByWorkspace(workspaceId);
  },

  async getById(id: string, workspaceId: string): Promise<IntegrationRow> {
    const integration = await integrationRepository.findById(id);
    if (integration.workspace_id !== workspaceId) {
      throw new AppError('integration not found', 404);
    }
    return integration;
  },

  async upsert(
    workspaceId: string,
    provider: IntegrationProvider,
    config: Record<string, unknown>
  ): Promise<IntegrationRow> {
    // Validate config shape and verify credentials for non-Gmail providers
    const schema = CONFIG_SCHEMAS[provider];
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message ?? 'invalid config', 400);
    }

    if (provider === 'whatsapp') {
      await whatsappService.validateConfig(parsed.data as WhatsAppConfig);
    } else if (provider === 'freshdesk') {
      await freshdeskService.validateConfig(parsed.data as FreshdeskConfig);
    }
    // Gmail config comes in via OAuth callback — no separate validation needed here

    return integrationRepository.upsert({
      workspace_id:   workspaceId,
      provider,
      status:         'active',
      config:         parsed.data,
      last_synced_at: null,
    });
  },

  async disconnect(id: string, workspaceId: string): Promise<void> {
    await this.getById(id, workspaceId);
    await integrationRepository.update(id, {
      status: 'disconnected',
      config: {},
    });
  },

  // Start a background sync job — returns immediately with a job ID
  async startSync(id: string, workspaceId: string, limit = 200, deepExtract = false): Promise<string> {
    const integration = await this.getById(id, workspaceId);
    if (integration.status !== 'active') {
      throw new AppError('integration is not connected', 400);
    }

    const jobId = crypto.randomUUID();
    const job: SyncJob = {
      id: jobId,
      integration_id: id,
      workspace_id: workspaceId,
      status: 'running',
      progress: { fetched: 0, total: 0, done: 0 },
      cancelled: false,
      created_at: Date.now(),
    };
    syncJobs.set(jobId, job);
    setTimeout(() => syncJobs.delete(jobId), JOB_TTL_MS);

    // Launch background work after the HTTP response is sent
    setImmediate(() => { void this._runSyncJob(job, integration, limit, deepExtract); });

    return jobId;
  },

  getSyncStatus(jobId: string): SyncJob {
    const job = syncJobs.get(jobId);
    if (!job) throw new AppError('sync job not found or expired', 404);
    return job;
  },

  cancelSync(jobId: string, workspaceId: string): void {
    const job = syncJobs.get(jobId);
    if (!job) throw new AppError('sync job not found or expired', 404);
    if (job.workspace_id !== workspaceId) throw new AppError('sync job not found or expired', 404);
    if (job.status !== 'running') throw new AppError('sync job is not running', 400);
    job.cancelled = true;
    job.status = 'cancelled';
  },

  async _runSyncJob(job: SyncJob, integration: IntegrationRow, limit: number, deepExtract = false): Promise<void> {
    const EXTRACT_BATCH = 3;
    try {
      let items: Array<{ id: string | number; conversation: string }> = [];

      if (integration.provider === 'gmail') {
        const cfg = integration.config as { refresh_token: string };
        const threads = await gmailService.fetchAllThreads(
          cfg.refresh_token,
          limit,
          (fetched, total) => {
            job.progress.fetched = fetched;
            job.progress.total = total;
          }
        );
        items = threads.map(t => ({ id: t.threadId, conversation: t.conversation }));
      } else if (integration.provider === 'whatsapp') {
        const convos = await whatsappService.fetchRecentConversations(
          integration.config as unknown as WhatsAppConfig, limit
        );
        items = convos.map(c => ({ id: c.conversationId, conversation: c.conversation }));
        job.progress.total = items.length;
      } else if (integration.provider === 'freshdesk') {
        const tickets = await freshdeskService.fetchRecentTickets(
          integration.config as unknown as FreshdeskConfig, limit
        );
        items = tickets.map(t => ({ id: t.ticketId, conversation: t.conversation }));
        job.progress.total = items.length;
      }

      job.progress.total = items.length;
      const allSkills: ExtractedSkill[] = [];
      const errors: string[] = [];

      // Extract in batches of 3, sequential between batches, with retry on 429
      for (let i = 0; i < items.length; i += EXTRACT_BATCH) {
        const batch = items.slice(i, i + EXTRACT_BATCH);
        const results = await Promise.allSettled(
          batch.map(item =>
            withRetry(() => extractionService.extractFromConversation(
              item.conversation,
              { deep: deepExtract, workspaceId: job.workspace_id }
            ))
          )
        );
        results.forEach((result, j) => {
          if (result.status === 'fulfilled') {
            allSkills.push(...result.value.skills);
          } else {
            errors.push(`Item ${batch[j].id}: ${(result.reason as any)?.message ?? 'extraction failed'}`);
          }
        });
        job.progress.done = Math.min(i + EXTRACT_BATCH, items.length);
        if (job.cancelled) break;
        // Brief pause between batches to avoid overwhelming the rate limit
        if (i + EXTRACT_BATCH < items.length) await sleep(1000);
      }

      if (job.cancelled) return;

      // Deduplicate: first by exact name, then by Jaccard on trigger_condition
      const byName = new Map<string, ExtractedSkill>();
      for (const skill of allSkills) {
        const key = skill.name.toLowerCase().trim();
        const existing = byName.get(key);
        if (!existing || skill.confidence > existing.confidence) byName.set(key, skill);
      }
      const nameDeduped = Array.from(byName.values());

      // Jaccard dedup on trigger_condition (threshold 0.70 — cross-conversation paraphrases)
      const seen: ExtractedSkill[] = [];
      for (const candidate of nameDeduped) {
        let isDup = false;
        for (let i = 0; i < seen.length; i++) {
          const sim = jaccardSimilarity(candidate.trigger_condition, seen[i].trigger_condition);
          if (sim >= 0.70) {
            if (candidate.confidence > seen[i].confidence) seen[i] = candidate;
            isDup = true;
            break;
          }
        }
        if (!isDup) seen.push(candidate);
      }

      await integrationRepository.touchLastSynced(integration.id);

      job.result = {
        integration_id:  integration.id,
        provider:        integration.provider,
        items_fetched:   items.length,
        extracted_skills: seen,
        errors,
      };
      job.status = 'done';
    } catch (err: any) {
      // Only mark integration as error for auth/credential failures, not transient errors
      if (err instanceof AppError && (err.statusCode === 401 || err.statusCode === 403)) {
        await integrationRepository.update(integration.id, { status: 'error' }).catch(() => {});
      }
      job.status = 'error';
      job.error = err?.message ?? 'unknown error';
    }
  },

  // Phase 2: create the skills the user selected
  async confirm(
    id: string,
    workspaceId: string,
    skills: ExtractedSkill[]
  ): Promise<ConfirmResult> {
    // Verify integration belongs to workspace
    await this.getById(id, workspaceId);

    let skills_created = 0;
    let skills_skipped = 0;
    const created_skills: SkillRow[] = [];
    const errors: string[] = [];

    for (const skill of skills) {
      try {
        const row = await skillService.create({
          workspace_id:       workspaceId,
          name:               skill.name,
          trigger_condition:  skill.trigger_condition,
          decision:           skill.decision,
          conditions:         skill.conditions.length > 0
            ? Object.fromEntries(skill.conditions.map((c, i) => [String(i), c]))
            : null,
          escalation_required: skill.escalation_required,
          confidence:          skill.confidence,
        });
        created_skills.push(row);
        skills_created++;
      } catch (err: any) {
        if (err instanceof AppError && err.statusCode === 409) {
          skills_skipped++;
        } else {
          errors.push(`"${skill.name}": ${err.message}`);
        }
      }
    }

    return { skills_created, skills_skipped, created_skills, errors };
  },
};
