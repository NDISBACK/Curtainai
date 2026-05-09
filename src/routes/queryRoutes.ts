import { Router } from 'express';
import { runQuery, submitOverride } from '../controllers/queryController';

const router = Router();

router.post('/', runQuery);
router.post('/override', submitOverride);

export default router;
