import { Router } from 'express';
import {
  createSkill,
  getSkill,
  updateSkill,
  deleteSkill,
  approveSkill,
  disableSkill,
  enableSkill,
  listSkills,
} from '../controllers/skillController';
import {
  exportSkills,
  importSkills,
  listSkillVersions,
  getSkillVersion,
  restoreSkillVersion,
} from '../controllers/exportController';
import { getSkillAnalytics } from '../controllers/analyticsController';

const router = Router();

// ── Collection routes ─────────────────────────────────────────────────────────
router.get('/', listSkills);
router.post('/', createSkill);

// Named static routes MUST come before /:id to prevent "export"/"import" being matched as IDs
router.get('/export', exportSkills);
router.post('/import', importSkills);

// ── Single-resource routes ────────────────────────────────────────────────────
router.get('/:id', getSkill);
router.patch('/:id', updateSkill);
router.delete('/:id', deleteSkill);
router.patch('/:id/approve', approveSkill);
router.patch('/:id/disable', disableSkill);
router.patch('/:id/enable', enableSkill);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/:id/analytics', getSkillAnalytics);

// ── Version history ───────────────────────────────────────────────────────────
router.get('/:id/versions', listSkillVersions);
router.get('/:id/versions/:version', getSkillVersion);
router.post('/:id/versions/:version/restore', restoreSkillVersion);

export default router;
