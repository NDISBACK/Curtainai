import { queryService } from './queryService';
import { exportService } from './exportService';
import type { WorkspaceRow } from '../types/entities';

const MCP_PROTOCOL_VERSION = '2024-11-05';

// ─── JSON-RPC error codes ─────────────────────────────────────────────────────

const RPC_PARSE_ERROR    = -32700;
const RPC_INVALID_REQUEST = -32600;
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INVALID_PARAMS  = -32602;
const RPC_INTERNAL_ERROR  = -32603;

function rpcError(code: number, message: string): never {
  const err = new Error(message) as Error & { rpcCode: number };
  err.rpcCode = code;
  throw err;
}

// ─── Method handlers ──────────────────────────────────────────────────────────

async function handleInitialize() {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: 'CurtainAI', version: '1.0.0' },
  };
}

async function handleToolsList(workspace: WorkspaceRow) {
  const tools = await exportService.exportForWorkspace(workspace.id, 'mcp_tools');
  return { tools };
}

interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

async function handleToolsCall(workspace: WorkspaceRow, params: unknown) {
  const p = params as ToolCallParams;

  if (!p?.name) {
    rpcError(RPC_INVALID_PARAMS, 'params.name is required');
  }

  const customerQuery = (p.arguments?.['customer_query'] ?? p.arguments?.['customer_input']) as string | undefined;
  if (!customerQuery?.trim()) {
    rpcError(RPC_INVALID_PARAMS, 'arguments.customer_query is required');
  }

  const result = await queryService.run({
    query: customerQuery,
    workspace_id: workspace.id,
    workspace,
  });

  return {
    content: [
      {
        type: 'text',
        text: result.decision,
      },
    ],
    isError: result.escalate,
    metadata: {
      skill_id: result.skill_id,
      confidence: result.confidence,
      query_id: result.query_id,
      escalate: result.escalate,
    },
  };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export const mcpService = {
  async handle(workspace: WorkspaceRow, method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case 'initialize':   return handleInitialize();
      case 'tools/list':   return handleToolsList(workspace);
      case 'tools/call':   return handleToolsCall(workspace, params);
      default:
        rpcError(RPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  },

  codes: {
    PARSE_ERROR:     RPC_PARSE_ERROR,
    INVALID_REQUEST: RPC_INVALID_REQUEST,
    METHOD_NOT_FOUND: RPC_METHOD_NOT_FOUND,
    INVALID_PARAMS:  RPC_INVALID_PARAMS,
    INTERNAL_ERROR:  RPC_INTERNAL_ERROR,
  },
};
