import { Router } from 'express';
import {
  listIntegrations,
  createIntegration,
  deleteIntegration,
  syncIntegration,
  getSyncStatus,
  confirmSync,
  getGmailOAuthUrl,
} from '../controllers/integrationController';

const router = Router();

// Returns the Google OAuth URL as JSON — frontend fetches this then redirects
router.get('/gmail/oauth/url', getGmailOAuthUrl);

// Standard CRUD
router.get('/', listIntegrations);
router.post('/', createIntegration);
router.delete('/:id', deleteIntegration);

// Async sync — start job, poll progress, confirm selected skills
router.post('/:id/sync', syncIntegration);
router.get('/:id/sync/status', getSyncStatus);
router.post('/:id/sync/confirm', confirmSync);

export default router;
