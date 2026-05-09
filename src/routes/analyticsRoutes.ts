import { Router } from 'express';
import { getSkillAnalytics } from '../controllers/analyticsController';

const router = Router({ mergeParams: true });

router.get('/analytics', getSkillAnalytics);

export default router;
