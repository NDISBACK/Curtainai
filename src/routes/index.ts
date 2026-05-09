import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { rateLimiter } from '../middleware/rateLimiter';
import { createWorkspace } from '../controllers/workspaceController';
import { getWorkspaceAnalytics, getQueryHistory } from '../controllers/analyticsController';
import healthRoutes from './healthRoutes';
import workspaceRoutes from './workspaceRoutes';
import skillRoutes from './skillRoutes';
import extractionRoutes from './extractionRoutes';
import queryRoutes from './queryRoutes';
import simulationRoutes from './simulationRoutes';
import waitlistRoutes from './waitlistRoutes';

const router = Router();

// Public routes — no auth required
router.use('/health', healthRoutes);

// Workspace registration is public (bootstrapping: create workspace → get API key → use API key)
router.post('/workspaces', createWorkspace);
router.use('/waitlist', waitlistRoutes);

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

// Simulation — read-only what-if engine
router.use('/simulate', simulationRoutes);

export default router;
