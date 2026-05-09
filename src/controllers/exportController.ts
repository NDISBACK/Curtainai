import { Request, Response } from 'express';
import { exportService, ExportFormat } from '../services/exportService';
import { importService } from '../services/importService';
import { skillService } from '../services/skillService';
import { skillVersionRepository } from '../repositories/skillVersionRepository';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { validateOrThrow } from '../validation';
import { ExportQuerySchema, ImportSkillsSchema } from '../validation/skill.schema';

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportSkills = catchAsync(async (req: Request, res: Response) => {
  const parsed = validateOrThrow(ExportQuerySchema, req.query);
  const format = (parsed.format ?? 'json') as ExportFormat;
  const skills = await exportService.exportForWorkspace(req.workspace.id, format, parsed.status);
  res.setHeader('X-Export-Count', String(skills.length));
  sendSuccess(res, skills);
});

// ─── Import ───────────────────────────────────────────────────────────────────

export const importSkills = catchAsync(async (req: Request, res: Response) => {
  const { skills } = validateOrThrow(ImportSkillsSchema, req.body);
  const result = await importService.importSkills(req.workspace.id, skills);
  sendSuccess(res, result, 207); // 207 Multi-Status: some may have been skipped
});

// ─── Version history ─────────────────────────────────────────────────────────

export const listSkillVersions = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id?.trim()) throw new AppError('skill id is required', 400);
  await skillService.assertOwnership(id, req.workspace.id);

  const versions = await skillVersionRepository.findBySkillId(id);
  sendSuccess(res, versions);
});

export const getSkillVersion = catchAsync(async (req: Request, res: Response) => {
  const { id, version } = req.params;
  if (!id?.trim()) throw new AppError('skill id is required', 400);
  const v = parseInt(version ?? '', 10);
  if (isNaN(v) || v < 1) throw new AppError('version must be a positive integer', 400);

  await skillService.assertOwnership(id, req.workspace.id);
  const versionRow = await skillVersionRepository.findBySkillIdAndVersion(id, v);
  sendSuccess(res, versionRow);
});

export const restoreSkillVersion = catchAsync(async (req: Request, res: Response) => {
  const { id, version } = req.params;
  if (!id?.trim()) throw new AppError('skill id is required', 400);
  const v = parseInt(version ?? '', 10);
  if (isNaN(v) || v < 1) throw new AppError('version must be a positive integer', 400);

  const existing = await skillService.assertOwnership(id, req.workspace.id);
  const versionRow = await skillVersionRepository.findBySkillIdAndVersion(id, v);

  // Create a new pending_review skill from the snapshot — does not mutate the current skill
  const restored = await skillService.create({
    workspace_id: existing.workspace_id,
    name: `${versionRow.name} (restored v${v})`,
    trigger_condition: versionRow.trigger_condition ?? '',
    decision: versionRow.decision ?? '',
    conditions: versionRow.conditions,
    escalation_required: versionRow.escalation_required,
    confidence: versionRow.confidence,
  });

  sendSuccess(res, restored, 201);
});
