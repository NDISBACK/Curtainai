import { Router } from 'express';
import { runSimulation } from '../controllers/simulationController';

const router = Router();

/**
 * POST /api/v1/simulate
 *
 * Re-runs historical queries against a modified skill set and returns a
 * before/after comparison. Read-only — no DB writes occur.
 *
 * Body: SimulationRequest (see validation/simulation.schema.ts)
 */
router.post('/', runSimulation);

export default router;
