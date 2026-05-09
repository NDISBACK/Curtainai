import { teamRepository } from '../repositories/teamRepository';
import { AppError } from '../utils/AppError';
import type { MemberRole } from '../types/entities';

export const teamService = {
  async list(workspaceId: string) {
    return teamRepository.findAllByWorkspace(workspaceId);
  },

  async add(workspaceId: string, email: string, role: MemberRole, name?: string, invitedByKeyId?: string) {
    if (!email?.trim()) throw new AppError('email is required', 400);
    if (!['admin', 'editor', 'viewer'].includes(role)) throw new AppError('invalid role', 400);
    return teamRepository.create({
      workspace_id: workspaceId,
      email: email.trim().toLowerCase(),
      name: name?.trim() || null,
      role,
      invited_by: invitedByKeyId ?? null,
    });
  },

  async updateRole(id: string, workspaceId: string, role: MemberRole, name?: string) {
    const member = await teamRepository.findById(id);
    if (member.workspace_id !== workspaceId) throw new AppError('Member not found', 404);
    const patch: Record<string, unknown> = { role };
    if (name !== undefined) patch['name'] = name.trim() || null;
    return teamRepository.update(id, patch);
  },

  async remove(id: string, workspaceId: string) {
    const member = await teamRepository.findById(id);
    if (member.workspace_id !== workspaceId) throw new AppError('Member not found', 404);
    await teamRepository.delete(id);
  },
};
