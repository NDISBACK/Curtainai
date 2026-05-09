import { Router } from 'express';
import { extractSkills } from '../controllers/extractionController';

const router = Router();

router.post('/', extractSkills);

export default router;
