import { WorkspaceRow } from './entities';

declare global {
  namespace Express {
    interface Request {
      workspace: WorkspaceRow;
      apiKeyId: string;
      correlationId: string;
    }
  }
}
