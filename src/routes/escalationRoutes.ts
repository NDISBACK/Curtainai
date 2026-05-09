import { Router } from 'express';
import { listEscalations, resolveEscalation } from '../controllers/escalationController';

const router = Router();

router.get('/', listEscalations);
router.patch('/:id/resolve', resolveEscalation);

export default router;
