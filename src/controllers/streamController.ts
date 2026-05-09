import { Request, Response } from 'express';
import { decisionEmitter } from '../services/queryService';

export const streamDecisions = (req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if present
  res.flushHeaders();

  const workspaceId = req.workspace.id;

  const handler = (event: Record<string, unknown>) => {
    if (event['workspace_id'] !== workspaceId) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  decisionEmitter.on('decision', handler);

  // Heartbeat every 25s to keep proxies from closing the connection
  const hb = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    decisionEmitter.off('decision', handler);
    clearInterval(hb);
  });
};
