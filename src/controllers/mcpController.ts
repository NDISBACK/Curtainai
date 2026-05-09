import { Request, Response } from 'express';
import { mcpService } from '../services/mcpService';

export const mcpHandler = async (req: Request, res: Response): Promise<void> => {
  const { jsonrpc, id, method, params } = req.body ?? {};

  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: mcpService.codes.INVALID_REQUEST, message: 'Invalid JSON-RPC 2.0 request' },
    });
    return;
  }

  try {
    const result = await mcpService.handle(req.workspace, method, params);
    res.json({ jsonrpc: '2.0', id: id ?? null, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const code = (err as { rpcCode?: number }).rpcCode ?? mcpService.codes.INTERNAL_ERROR;
    res.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
  }
};
