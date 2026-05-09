import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { rateLimiter } from '../middleware/rateLimiter';
import { mcpHandler } from '../controllers/mcpController';

const router = Router();

// MCP uses a single POST endpoint — JSON-RPC 2.0 method dispatch happens inside the handler
router.post('/', authenticate, rateLimiter, mcpHandler);

export default router;
