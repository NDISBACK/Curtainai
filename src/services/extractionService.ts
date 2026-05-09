import OpenAI from 'openai';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { validateOrThrow } from '../validation';
import { ExtractedSkillSchema, LLMExtractionResponseSchema } from '../validation/extraction.schema';
import { jaccardSimilarity } from '../utils/similarity';
import { skillRepository } from '../repositories/skillRepository';
import { embeddingService } from './embeddingService';

const openaiClient = new OpenAI({ apiKey: env.openai.apiKey });

const MAX_CONVERSATION_LENGTH = 50_000;
const MAX_CHUNK_CHARS         = 15_000;
const SEGMENT_LLM_THRESHOLD   = 8_000;

// ─── Prompts ──────────────────────────────────────────────────────────────────

const EXTRACTION_BASE_PROMPT = `You are a skill extraction engine for a customer support automation system. Your sole function is to analyze support conversations and extract structured skill objects from them. You do not answer questions, provide opinions, or perform any task other than extraction.

A "skill" represents a reusable decision pattern: a recurring situation a support agent encounters and how they resolve it.

Each skill object has exactly these fields:

- name (string): A short, descriptive label for the skill. Max 200 characters. Example: "Billing Dispute Resolution".
- trigger_condition (string): The specific customer situation or question that activates this skill. Max 500 characters. Example: "Customer disputes a charge and requests a refund for a subscription they were unaware of".
- decision (string): The agent's action or response pattern when this skill is triggered. Max 500 characters. Example: "Verify the charge, offer a one-time courtesy refund if within 30 days, escalate to billing if outside window".
- conditions (array of strings): Zero or more qualifying conditions that must also be true for this skill to apply. Each element is a plain string. Example: ["account is in good standing", "charge occurred within 90 days"]. If there are no conditions, return an empty array [].
- escalation_required (boolean): true if the resolution requires escalation to a human specialist or another team; false if the agent can resolve it directly.
- confidence (number): Your confidence that this is a genuine, reusable skill pattern, not a one-off edge case. A float between 0.0 (no confidence) and 1.0 (certain). Use 0.9+ only for clear, repeated patterns.

EXACT OUTPUT FORMAT:
Return a single JSON object with a top-level key "skills" whose value is an array of skill objects. Do not include any text, explanation, markdown, code fences, or commentary outside of the JSON object. Do not add any fields beyond those listed above.

{
  "skills": [
    {
      "name": "...",
      "trigger_condition": "...",
      "decision": "...",
      "conditions": [],
      "escalation_required": false,
      "confidence": 0.0
    }
  ]
}

If the conversation contains no identifiable skill patterns, return: { "skills": [] }

EXAMPLE:

Input conversation:
---
Agent: Thanks for reaching out! How can I help you today?
Customer: I was charged twice for my subscription this month.
Agent: I'm sorry to hear that. Let me pull up your account. I can see a duplicate charge on the 3rd and the 15th. I'll go ahead and issue a refund for the duplicate — you should see it in 3–5 business days.
Customer: Thank you so much!
Agent: Of course! Is there anything else I can help you with?
---

Expected output:
{
  "skills": [
    {
      "name": "Duplicate Charge Refund",
      "trigger_condition": "Customer reports being charged twice for the same subscription period",
      "decision": "Verify the duplicate charge on the account, issue a refund for the duplicate transaction, inform customer of 3–5 business day processing time",
      "conditions": ["duplicate charge is confirmed visible on account"],
      "escalation_required": false,
      "confidence": 0.92
    }
  ]
}`;

const PASS_1_ADDENDUM = `

EXTRACTION PHILOSOPHY — READ THIS CAREFULLY:
- This conversation may cover MULTIPLE distinct customer issues. Extract a separate skill for EACH distinct issue.
- Include IMPLICIT actions — things the agent did between messages that weren't announced to the customer (e.g. checking account flags, creating internal tickets, logging notes).
- Include ALL of the following patterns when present:
    • Policy explanations the agent gave
    • Account verification or identity-check steps
    • Routing or transfer decisions (even silent ones)
    • Proactive offers the agent made unprompted
    • Silent escalations or internal ticket creation
    • Multi-step resolution flows broken into clear decision steps
    • Negative decisions: when the agent chose NOT to do something and why
- Be BROAD. Confidence ≥ 0.55 is enough to include a skill. It is better to extract 10 skills and let the user discard 2 than to miss a real pattern.
- Do NOT skip a skill just because you only see one example — it may still represent a common pattern.`;

const CRITIC_SYSTEM_PROMPT = `You are a skill auditor for a customer support automation system. A first-pass AI analysis has already extracted some skills from a support conversation. Your sole job is to find what was MISSED.

A "skill" is a reusable decision pattern: a recurring situation + how the agent resolved it.

Focus ONLY on patterns the first pass typically misses:
1. SILENT AGENT ACTIONS — steps taken between customer messages not narrated to the customer (checking account notes, creating internal tickets, tagging the conversation, updating CRM fields)
2. IMPLICIT POLICIES — agent behavior that implies a policy even if unstated (e.g., agent always verifies identity before taking action = a verification skill)
3. EDGE CASE PATHS — moments where the agent deviated from standard handling (the reason for deviation is the skill)
4. COMPOUND STEPS — two actions that always pair together (extract as one compound skill)
5. NEGATIVE DECISIONS — when the agent chose NOT to do something (e.g., "declined refund because outside 30-day window" is a skill)
6. TOPIC SPLITS — if the conversation covered more than one customer issue, ensure each issue has its own distinct skill

You will receive:
- The original conversation
- Already-extracted skills (JSON array) — do NOT re-extract these or anything semantically equivalent

Return ONLY newly discovered skills in this exact JSON format:
{ "skills": [...] }

If nothing was missed, return: { "skills": [] }

The same field schema applies:
- name (string, max 200 chars)
- trigger_condition (string, max 500 chars)
- decision (string, max 500 chars)
- conditions (array of strings, may be empty [])
- escalation_required (boolean)
- confidence (number 0.0–1.0, include only if >= 0.55)`;

const MERGE_SYSTEM_PROMPT = `You are a skill curator. You will receive candidate skills from multiple extraction passes over the same conversation. Produce the final, clean, deduplicated skill list.

INSTRUCTIONS:

1. DEDUPLICATE — If two or more skills describe the same pattern (even if worded differently), keep the best one. Merge their conditions arrays. Use the highest confidence score.

2. NORMALIZE QUALITY:
   - name: ≤ 60 chars, title case, specific (bad: "Handle Issue", good: "Duplicate Charge Refund")
   - trigger_condition: specific, starts with "Customer..." or "When customer...", ≤ 500 chars
   - decision: concrete agent steps, starts with an action verb, ≤ 500 chars
   - Remove skills whose trigger_condition is too vague to be actionable

3. CONFIDENCE FILTER — Remove any skill with confidence < 0.55

4. CATEGORY — Add a "category" field to each skill from exactly this list:
   billing, refunds, shipping, account, technical, policy, escalation, onboarding, cancellation, other

5. Return the result as:
{
  "skills": [
    {
      "name": "...",
      "trigger_condition": "...",
      "decision": "...",
      "conditions": [],
      "escalation_required": false,
      "confidence": 0.0,
      "category": "billing"
    }
  ],
  "categories_detected": ["billing", "refunds"]
}

Candidate skills to process:
`;

// ─── Exported types ───────────────────────────────────────────────────────────

export interface ExtractedSkill {
  name: string;
  trigger_condition: string;
  decision: string;
  conditions: string[];
  escalation_required: boolean;
  confidence: number;
  existing_skill_match?: { name: string; similarity: number };
}

export interface ExtractionOptions {
  deep?:        boolean;
  workspaceId?: string;
}

export interface ExtractionMeta {
  passes_run:          number;
  segments_detected:   number;
  chunks_processed:    number;
  pass1_count:         number;
  pass2_count:         number;
  merged_count:        number;
  categories_detected?: string[];
  quality_warning?:    string;
}

export interface ExtractionResult {
  skills:                  ExtractedSkill[];
  raw_conversation_length: number;
  extracted_count:         number;
  meta?:                   ExtractionMeta;
}

// ─── OpenAI error mapper ──────────────────────────────────────────────────────

function mapOpenAIError(err: unknown): never {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) throw new AppError('OpenAI rate limit exceeded', 429);
    if (err.status === 401) throw new AppError('Invalid OpenAI API key', 502);
    throw new AppError(`OpenAI error: ${err.message}`, 502);
  }
  const message = err instanceof Error ? err.message : String(err);
  throw new AppError(`OpenAI request failed: ${message}`, 502);
}

// ─── Response parsers ─────────────────────────────────────────────────────────

function parseSkillsFromContent(content: string): ExtractedSkill[] {
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch {
    throw new AppError('LLM returned malformed JSON', 422);
  }
  const { skills: rawSkills } = validateOrThrow(LLMExtractionResponseSchema, parsed, 422);
  const skills: ExtractedSkill[] = [];
  for (const raw of rawSkills) {
    const r = ExtractedSkillSchema.safeParse(raw);
    if (r.success) {
      // Strip category before returning — only used internally for meta
      const rest = r.data as Record<string, unknown>;
      delete rest['category'];
      skills.push(rest as unknown as ExtractedSkill);
    }
  }
  return skills;
}

function parseSkillsRecoverable(content: string): ExtractedSkill[] {
  try { return parseSkillsFromContent(content); } catch { return []; }
}

// ─── Pre-processing ───────────────────────────────────────────────────────────

const EMAIL_HEADER_RE = /^(From|To|Cc|Bcc|Subject|Date|Sent|Reply-To):.*$/gim;
const QUOTE_DIVIDER_RE = /^-{3,}.*$/gm;
const ON_WROTE_RE = /^On .{10,100} wrote:$/gim;
const TIMESTAMP_RE = /\[?\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\]?/g;
const TICKET_META_RE = /^(Ticket\s*#\d+|Status:|Priority:|Assignee:|Created:|Updated:|Tags:|Category:)[^\n]*/gim;

function normalizeConversation(raw: string): {
  normalized: string;
  agentTurnCount: number;
  customerTurnCount: number;
} {
  let text = raw
    .replace(EMAIL_HEADER_RE, '')
    .replace(ON_WROTE_RE, '')
    .replace(QUOTE_DIVIDER_RE, '')
    .replace(TICKET_META_RE, '')
    .replace(TIMESTAMP_RE, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Label agent vs customer turns using common heuristics
  const AGENT_KEYWORDS = /\b(support|agent|team|representative|rep|service|help\s*desk|helpdesk|advisor|specialist|operator)\b/i;
  let agentTurnCount = 0;
  let customerTurnCount = 0;

  // Count labeled turns if already labeled
  const labeledAgent    = (text.match(/^(?:Agent|Support|Representative|Rep|Operator|Advisor):/gim) || []).length;
  const labeledCustomer = (text.match(/^(?:Customer|User|Client|Guest|You|Me):/gim) || []).length;

  if (labeledAgent + labeledCustomer > 0) {
    agentTurnCount    = labeledAgent;
    customerTurnCount = labeledCustomer;
  } else {
    // Heuristic: lines containing agent keywords are likely agent turns
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim().length < 5) continue;
      if (AGENT_KEYWORDS.test(line)) agentTurnCount++;
      else if (line.trim().length > 10) customerTurnCount++;
    }
    // Floor estimate
    agentTurnCount = Math.max(agentTurnCount, 0);
  }

  return { normalized: text, agentTurnCount, customerTurnCount };
}

const TOPIC_BOUNDARY_PHRASES = [
  'another question', 'separate issue', 'one more thing', 'also wanted to ask',
  'different issue', 'another problem', 'while i have you', 'one other thing',
  'second question', 'unrelated but', 'also i wanted', 'also need help',
  'change of subject', 'switching topics', 'new question',
];

function detectSegmentsHeuristic(conversation: string): number {
  const lower = conversation.toLowerCase();
  let count = 0;
  for (const phrase of TOPIC_BOUNDARY_PHRASES) {
    if (lower.includes(phrase)) count++;
  }
  return count;
}

async function detectSegments(conversation: string): Promise<string[]> {
  const boundaryCount = detectSegmentsHeuristic(conversation);

  if (boundaryCount >= 2) {
    // Try to split on the strongest signals
    for (const phrase of TOPIC_BOUNDARY_PHRASES) {
      const idx = conversation.toLowerCase().indexOf(phrase);
      if (idx > 200) {
        // Split roughly at this point, on the nearest newline
        const splitPoint = conversation.indexOf('\n', idx);
        if (splitPoint > 0 && splitPoint < conversation.length - 100) {
          return [
            conversation.slice(0, splitPoint).trim(),
            conversation.slice(splitPoint).trim(),
          ].filter(s => s.length > 50);
        }
      }
    }
  }

  // LLM-assisted detection for long ambiguous conversations
  if (boundaryCount < 2 && conversation.length > SEGMENT_LLM_THRESHOLD) {
    try {
      const snippet = conversation.slice(0, 3000);
      const resp = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 150,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Analyze this support conversation excerpt. Return JSON: {"multi_topic": true/false, "topic_count": N}' },
          { role: 'user', content: snippet },
        ],
      });
      const raw = JSON.parse(resp.choices[0]?.message?.content ?? '{}');
      if (raw.multi_topic && raw.topic_count >= 2) {
        // We detected multi-topic but couldn't split cleanly — return as one segment
        // (the LLM passes will handle multi-topic within a single segment)
      }
    } catch {
      // Segment detection failure is non-fatal — fall through to single segment
    }
  }

  return [conversation];
}

function chunkConversation(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  // Split at "Agent:" or "Agent " labeled turn starts
  const turnBoundaryRe = /(?=^(?:Agent|Support|Representative|Operator)[:\ ])/im;
  const turns = text.split(turnBoundaryRe);

  let current = '';
  let lastTurn = '';

  for (const turn of turns) {
    if ((current + turn).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      // Overlap: start next chunk with the last agent turn for context
      current = lastTurn + turn;
    } else {
      current += turn;
    }
    if (turn.trim().length > 0) lastTurn = turn;
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

// ─── In-pipeline deduplication ────────────────────────────────────────────────

function dedupByName(skills: ExtractedSkill[]): ExtractedSkill[] {
  const seen = new Map<string, ExtractedSkill>();
  for (const sk of skills) {
    const key = sk.name.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing || sk.confidence > existing.confidence) seen.set(key, sk);
  }
  return Array.from(seen.values());
}

function dedupByJaccard(skills: ExtractedSkill[], threshold = 0.85): ExtractedSkill[] {
  const result: ExtractedSkill[] = [];
  for (const candidate of skills) {
    let isDuplicate = false;
    for (let i = 0; i < result.length; i++) {
      const sim = jaccardSimilarity(candidate.trigger_condition, result[i].trigger_condition);
      if (sim >= threshold) {
        // Keep higher confidence
        if (candidate.confidence > result[i].confidence) {
          result[i] = {
            ...candidate,
            conditions: [...new Set([...candidate.conditions, ...result[i].conditions])],
          };
        }
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) result.push(candidate);
  }
  return result;
}

// ─── Individual LLM calls ─────────────────────────────────────────────────────

async function runPass1(chunk: string): Promise<ExtractedSkill[]> {
  let response: OpenAI.Chat.ChatCompletion;
  try {
    response = await openaiClient.chat.completions.create({
      model: env.openai.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 2500,
      messages: [
        { role: 'system', content: EXTRACTION_BASE_PROMPT + PASS_1_ADDENDUM },
        { role: 'user', content: `Extract ALL skills from the following support conversation:\n\n---\n${chunk}\n---` },
      ],
    });
  } catch (err) { mapOpenAIError(err); }
  const content = response!.choices[0]?.message?.content ?? '';
  if (!content) return [];
  return parseSkillsFromContent(content);
}

async function runPass2(segment: string, pass1Skills: ExtractedSkill[]): Promise<ExtractedSkill[]> {
  let response: OpenAI.Chat.ChatCompletion;
  try {
    response = await openaiClient.chat.completions.create({
      model: env.openai.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      messages: [
        { role: 'system', content: CRITIC_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `ORIGINAL CONVERSATION:\n---\n${segment}\n---\n\nALREADY EXTRACTED (do NOT repeat):\n${JSON.stringify(pass1Skills, null, 2)}\n\nFind only NEW skills the first pass missed.`,
        },
      ],
    });
  } catch (err) {
    // Pass 2 failure is recoverable
    console.error('[extractionService] Pass 2 failed:', (err as Error).message);
    return [];
  }
  const content = response!.choices[0]?.message?.content ?? '';
  return parseSkillsRecoverable(content);
}

async function runPass3(candidates: ExtractedSkill[]): Promise<{ skills: ExtractedSkill[]; categories: string[] }> {
  let response: OpenAI.Chat.ChatCompletion;
  // Cap input to avoid overwhelming the context window
  const capped = candidates.slice(0, 40);
  try {
    response = await openaiClient.chat.completions.create({
      model: env.openai.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: MERGE_SYSTEM_PROMPT + JSON.stringify(capped, null, 2),
        },
        { role: 'user', content: 'Produce the final deduplicated, normalized skill list.' },
      ],
    });
  } catch (err) {
    console.error('[extractionService] Pass 3 failed:', (err as Error).message);
    return { skills: candidates, categories: [] };
  }

  const content = response!.choices[0]?.message?.content ?? '';
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(content); } catch {
    return { skills: candidates, categories: [] };
  }

  const categories: string[] = Array.isArray(parsed['categories_detected'])
    ? (parsed['categories_detected'] as string[])
    : [];

  const rawSkills = Array.isArray(parsed['skills']) ? parsed['skills'] : [];
  const skills: ExtractedSkill[] = [];
  for (const raw of rawSkills) {
    const r = ExtractedSkillSchema.safeParse(raw);
    if (r.success) {
      const data = r.data as Record<string, unknown>;
      delete data['category']; // strip before returning
      skills.push(data as unknown as ExtractedSkill);
    }
  }

  return { skills: skills.length > 0 ? skills : candidates, categories };
}

// ─── Cross-workspace dedup ────────────────────────────────────────────────────

async function flagExistingWorkspaceMatches(
  skills: ExtractedSkill[],
  workspaceId: string
): Promise<ExtractedSkill[]> {
  const embeddings = await Promise.allSettled(
    skills.map(s => embeddingService.embed(s.trigger_condition))
  );

  return Promise.all(
    skills.map(async (skill, i) => {
      const embResult = embeddings[i];
      if (embResult.status !== 'fulfilled') return skill;

      const matches = await skillRepository.findDuplicatesByVector(
        workspaceId,
        embResult.value,
        0.80
      ).catch(() => []);

      if (matches.length > 0) {
        return {
          ...skill,
          existing_skill_match: { name: matches[0].name, similarity: matches[0].similarity },
        };
      }
      return skill;
    })
  );
}

// ─── Deep pipeline ────────────────────────────────────────────────────────────

async function runDeepExtractionPipeline(
  conversation: string,
  options: ExtractionOptions
): Promise<ExtractionResult> {
  const { normalized, agentTurnCount } = normalizeConversation(conversation);

  const meta: ExtractionMeta = {
    passes_run:        1,
    segments_detected: 1,
    chunks_processed:  0,
    pass1_count:       0,
    pass2_count:       0,
    merged_count:      0,
  };

  // Short-circuit: not enough signal for multi-pass
  if (agentTurnCount < 2) {
    meta.quality_warning = 'Fewer than 2 agent turns detected — running single-pass extraction';
    const skills = await runPass1(normalized);
    meta.pass1_count = skills.length;
    meta.merged_count = skills.length;
    meta.chunks_processed = 1;
    return { skills, raw_conversation_length: conversation.length, extracted_count: skills.length, meta };
  }

  // Segment detection
  const segments = await detectSegments(normalized);
  meta.segments_detected = segments.length;

  // Chunk each segment for Pass 1
  const allChunks: Array<{ segmentIdx: number; chunk: string }> = [];
  for (let si = 0; si < segments.length; si++) {
    const chunks = chunkConversation(segments[si]);
    for (const chunk of chunks) allChunks.push({ segmentIdx: si, chunk });
  }
  meta.chunks_processed = allChunks.length;

  // ── Pass 1: Broad extraction — all chunks in parallel ─────────────────────
  const pass1Results = await Promise.allSettled(allChunks.map(c => runPass1(c.chunk)));
  const pass1Skills: ExtractedSkill[] = [];
  for (const r of pass1Results) {
    if (r.status === 'fulfilled') pass1Skills.push(...r.value);
  }
  meta.pass1_count = pass1Skills.length;

  // ── Pass 2: Critic — per segment, sequential ──────────────────────────────
  const pass2Skills: ExtractedSkill[] = [];
  for (const segment of segments) {
    const segmentPass1 = pass1Skills; // give critic visibility into all pass1 results
    const newSkills = await runPass2(segment, segmentPass1);
    pass2Skills.push(...newSkills);
  }
  meta.pass2_count = pass2Skills.length;
  meta.passes_run = 2;

  // ── Pre-merge dedup (Jaccard + name, no LLM) ─────────────────────────────
  const combined = [...pass1Skills, ...pass2Skills];
  const preDeduped = dedupByJaccard(dedupByName(combined), 0.85);

  // ── Pass 3: Merge, normalize, categorize ─────────────────────────────────
  meta.passes_run = 3;
  const { skills: mergedSkills, categories } = await runPass3(preDeduped);
  meta.merged_count = mergedSkills.length;
  meta.categories_detected = categories;

  // ── Optional cross-workspace dedup ───────────────────────────────────────
  let finalSkills = mergedSkills;
  if (options.workspaceId) {
    finalSkills = await flagExistingWorkspaceMatches(mergedSkills, options.workspaceId);
  }

  return {
    skills:                  finalSkills,
    raw_conversation_length: conversation.length,
    extracted_count:         finalSkills.length,
    meta,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const extractionService = {
  async extractFromConversation(
    conversation: string,
    options?: ExtractionOptions
  ): Promise<ExtractionResult> {
    if (conversation.length > MAX_CONVERSATION_LENGTH) {
      throw new AppError(
        `conversation exceeds maximum length of ${MAX_CONVERSATION_LENGTH} characters`,
        400
      );
    }

    if (options?.deep) {
      return runDeepExtractionPipeline(conversation, options);
    }

    // ── Single-pass (default, backward-compatible) ─────────────────────────
    let response: OpenAI.Chat.ChatCompletion | undefined;
    try {
      response = await openaiClient.chat.completions.create({
        model: env.openai.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        messages: [
          { role: 'system', content: EXTRACTION_BASE_PROMPT },
          { role: 'user', content: `Extract skills from the following support conversation:\n\n---\n${conversation}\n---` },
        ],
      });
    } catch (err) { mapOpenAIError(err); }

    const content = response!.choices[0]?.message?.content ?? '';
    if (!content) throw new AppError('LLM returned empty response', 422);

    const skills = parseSkillsFromContent(content);

    return {
      skills,
      raw_conversation_length: conversation.length,
      extracted_count: skills.length,
    };
  },
};
