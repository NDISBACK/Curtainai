import { Router } from 'express';
import {
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../controllers/workspaceController';

const router = Router();

router.get('/:id', getWorkspace);
router.patch('/:id', updateWorkspace);
router.delete('/:id', deleteWorkspace);

router.post('/:id/api-keys', createApiKey);
router.get('/:id/api-keys', listApiKeys);
router.delete('/:id/api-keys/:keyId', revokeApiKey);

export default router;
