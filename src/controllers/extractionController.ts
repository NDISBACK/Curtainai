import { Request, Response } from 'express';
import { extractionService } from '../services/extractionService';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { validateOrThrow } from '../validation';
import { ExtractConversationSchema } from '../validation/extraction.schema';
import type { ExtractedSkill } from '../services/extractionService';

export const extractSkills = catchAsync(async (req: Request, res: Response) => {
  const { conversation, conversations, deep, workspace_id } =
    validateOrThrow(ExtractConversationSchema, req.body);

  const opts = { deep, workspaceId: workspace_id };

  // ── Batch mode: multiple conversations ──────────────────────────────────────
  if (conversations && conversations.length > 0) {
    const results = await Promise.allSettled(
      conversations.map(c => extractionService.extractFromConversation(c, opts))
    );

    const allSkills: ExtractedSkill[] = [];
    const errors: string[] = [];

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') allSkills.push(...r.value.skills);
      else errors.push(`Conversation ${i + 1}: ${(r.reason as Error)?.message ?? 'Unknown error'}`);
    });

    // Cross-conversation dedup by name — keep highest confidence
    const seen = new Map<string, ExtractedSkill>();
    for (const sk of allSkills) {
      const key = sk.name.toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing || sk.confidence > existing.confidence) seen.set(key, sk);
    }

    const dedupedSkills = Array.from(seen.values());
    return sendSuccess(res, {
      skills:                  dedupedSkills,
      conversations_processed: conversations.length,
      extracted_count:         dedupedSkills.length,
      errors:                  errors.length > 0 ? errors : undefined,
    }, 200);
  }

  // ── Single conversation mode ─────────────────────────────────────────────────
  const result = await extractionService.extractFromConversation(conversation!, opts);
  sendSuccess(res, result, 200);
});
