import { Router } from 'express';
import { createWaitlistSignup } from '../controllers/waitlistController';

const router = Router();

router.post('/', createWaitlistSignup);

export default router;
