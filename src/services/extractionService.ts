import OpenAI from 'openai';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { validateOrThrow } from '../validation';
import { ExtractedSkillSchema, LLMExtractionResponseSchema } from '../validation/extraction.schema';

// ─── OpenAI client (singleton, instantiated once at module load) ──────────────

const openaiClient = new OpenAI({ apiKey: env.openai.apiKey });

const MAX_CONVERSATION_LENGTH = 50_000;

// ─── System prompt ────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a skill extraction engine for a customer support automation system. Your sole function is to analyze support conversations and extract structured skill objects from them. You do not answer questions, provide opinions, or perform any task other than extraction.

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

// ─── Exported types ───────────────────────────────────────────────────────────

export interface ExtractedSkill {
  name: string;
  trigger_condition: string;
  decision: string;
  conditions: string[];
  escalation_required: boolean;
  confidence: number;
}

export interface ExtractionResult {
  skills: ExtractedSkill[];
  raw_conversation_length: number;
  extracted_count: number;
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

// ─── Response parser ──────────────────────────────────────────────────────────

function parseOpenAIResponse(content: string): ExtractedSkill[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError('LLM returned malformed JSON', 422);
  }

  const { skills: rawSkills } = validateOrThrow(LLMExtractionResponseSchema, parsed, 422);

  const skills: ExtractedSkill[] = [];
  for (let i = 0; i < rawSkills.length; i++) {
    const result = ExtractedSkillSchema.safeParse(rawSkills[i]);
    if (result.success) skills.push(result.data);
  }

  return skills;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const extractionService = {
  async extractFromConversation(conversation: string): Promise<ExtractionResult> {
    if (conversation.length > MAX_CONVERSATION_LENGTH) {
      throw new AppError(
        `conversation exceeds maximum length of ${MAX_CONVERSATION_LENGTH} characters`,
        400
      );
    }

    let response: OpenAI.Chat.ChatCompletion | undefined;
    try {
      response = await openaiClient.chat.completions.create({
        model: env.openai.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: EXTRACTION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Extract skills from the following support conversation:\n\n---\n${conversation}\n---`,
          },
        ],
      });
    } catch (err) {
      mapOpenAIError(err);
    }

    const content = response!.choices[0]?.message?.content ?? '';
    if (!content) throw new AppError('LLM returned empty response', 422);

    const skills = parseOpenAIResponse(content);

    return {
      skills,
      raw_conversation_length: conversation.length,
      extracted_count: skills.length,
    };
  },
};
