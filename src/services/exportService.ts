import { skillRepository } from '../repositories/skillRepository';
import type { SkillRow, SkillStatus } from '../types/entities';

export type ExportFormat = 'openai_functions' | 'mcp_tools' | 'langchain' | 'json';

// ─── Format type definitions ──────────────────────────────────────────────────

export interface OpenAIFunctionDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface MCPToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface LangChainToolDef {
  name: string;
  description: string;
  func: string;
  metadata: {
    skill_id: string;
    escalation_required: boolean;
    confidence: number | null;
  };
}

// ─── Name sanitization ────────────────────────────────────────────────────────

export function sanitizeToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || 'skill';
}

// ─── Converters ───────────────────────────────────────────────────────────────

function toOpenAIFunction(skill: SkillRow): OpenAIFunctionDef {
  return {
    name: sanitizeToolName(skill.name),
    description: skill.trigger_condition ?? skill.name,
    parameters: {
      type: 'object',
      properties: {
        customer_input: {
          type: 'string',
          description: 'The customer message or query that triggered this skill',
        },
      },
      required: ['customer_input'],
    },
  };
}

function toMCPTool(skill: SkillRow): MCPToolDef {
  const descParts = [skill.trigger_condition];
  if (skill.decision) descParts.push(`Resolution: ${skill.decision}`);
  if (skill.escalation_required) descParts.push('Requires escalation to a human specialist.');

  return {
    name: sanitizeToolName(skill.name),
    description: descParts.filter(Boolean).join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        customer_query: {
          type: 'string',
          description: 'The customer query or message to handle with this skill',
        },
      },
      required: ['customer_query'],
    },
  };
}

function toLangChainTool(skill: SkillRow): LangChainToolDef {
  return {
    name: sanitizeToolName(skill.name),
    description: skill.trigger_condition ?? skill.name,
    func: 'curtainai_query',
    metadata: {
      skill_id: skill.id,
      escalation_required: skill.escalation_required,
      confidence: skill.confidence,
    },
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const exportService = {
  async exportForWorkspace(
    workspaceId: string,
    format: ExportFormat,
    statusFilter: SkillStatus = 'active'
  ): Promise<unknown[]> {
    const skills = await skillRepository.findAllByWorkspace(workspaceId, 1, 1000, statusFilter);

    switch (format) {
      case 'openai_functions': return skills.map(toOpenAIFunction);
      case 'mcp_tools':        return skills.map(toMCPTool);
      case 'langchain':        return skills.map(toLangChainTool);
      case 'json':             return skills;
    }
  },
};
