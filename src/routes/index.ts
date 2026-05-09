import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { rateLimiter } from '../middleware/rateLimiter';
import { createWorkspace } from '../controllers/workspaceController';
import { getWorkspaceAnalytics, getQueryHistory, getGapAnalysis } from '../controllers/analyticsController';
import { streamDecisions } from '../controllers/streamController';
import { gmailOAuthCallback } from '../controllers/integrationController';
import healthRoutes from './healthRoutes';
import workspaceRoutes from './workspaceRoutes';
import skillRoutes from './skillRoutes';
import extractionRoutes from './extractionRoutes';
import queryRoutes from './queryRoutes';
import simulationRoutes from './simulationRoutes';
import waitlistRoutes from './waitlistRoutes';
import integrationRoutes from './integrationRoutes';
import escalationRoutes from './escalationRoutes';
import auditRoutes from './auditRoutes';
import teamRoutes from './teamRoutes';

const router = Router();

// Public routes — no auth required
router.use('/health', healthRoutes);

// Workspace registration is public (bootstrapping: create workspace → get API key → use API key)
router.post('/workspaces', createWorkspace);
router.use('/waitlist', waitlistRoutes);

// Gmail OAuth callback is public — Google redirects here without an API key;
// workspace identity is recovered from the 'state' query parameter
router.get('/integrations/gmail/oauth/callback', gmailOAuthCallback);

// All other routes require a valid API key
router.use(authenticate);
router.use(rateLimiter);

// Authenticated workspace routes (GET/PATCH/DELETE + api-keys + analytics)
router.use('/workspaces', workspaceRoutes);
router.get('/workspaces/:id/analytics', getWorkspaceAnalytics);

// Skills, extraction, queries
router.use('/skills', skillRoutes);
router.use('/extract', extractionRoutes);
router.use('/query', queryRoutes);

// Query history
router.get('/queries', getQueryHistory);

// Gap analysis — clusters of unhandled queries
router.get('/analytics/gaps', getGapAnalysis);

// Simulation — read-only what-if engine
router.use('/simulate', simulationRoutes);

// Integrations — Gmail, WhatsApp, Freshdesk connections
router.use('/integrations', integrationRoutes);

// Escalation inbox
router.use('/escalations', escalationRoutes);

// Audit log
router.use('/audit', auditRoutes);

// Team members
router.use('/team', teamRoutes);

// Live decision stream (SSE) — auth via query param ?key=cai_... (EventSource can't set headers)
router.get('/stream/decisions', streamDecisions);

export default router;
