import { WorkspaceRow } from './entities';

declare global {
  namespace Express {
    interface Request {
      workspace: WorkspaceRow;
      apiKeyId: string;
      apiKeyScope: 'full' | 'read_only' | 'query_only';
      correlationId: string;
    }
  }
}
