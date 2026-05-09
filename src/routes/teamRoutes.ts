import { Router } from 'express';
import { listTeam, addMember, updateMember, removeMember } from '../controllers/teamController';

const router = Router();

router.get('/', listTeam);
router.post('/', addMember);
router.patch('/:id', updateMember);
router.delete('/:id', removeMember);

export default router;
