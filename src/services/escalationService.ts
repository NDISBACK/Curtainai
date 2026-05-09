import nodemailer from 'nodemailer';
import { queryRepository } from '../repositories/queryRepository';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import type { WorkspaceSettings } from '../types/entities';

export interface EscalationPayload {
  query_id: string;
  workspace_id: string;
  query: string;
  decision: string;
  confidence: number;
  created_at: string;
}

// Send webhook + optional email. Fire-and-forget — callers do not await.
export async function fireEscalationNotification(
  payload: EscalationPayload,
  settings: WorkspaceSettings
): Promise<void> {
  const promises: Promise<unknown>[] = [];

  if (settings.escalation_webhook_url) {
    promises.push(
      fetch(settings.escalation_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'query.escalated', ...payload }),
        signal: AbortSignal.timeout(8000),
      }).then(async r => {
        if (!r.ok) logger.warn('escalation.webhook_failed', { status: r.status, query_id: payload.query_id });
      }).catch(err => {
        logger.warn('escalation.webhook_error', { error: String(err), query_id: payload.query_id });
      })
    );
  }

  if (settings.escalation_email) {
    const smtpUrl = process.env['SMTP_URL'];
    if (smtpUrl) {
      const transporter = nodemailer.createTransport(smtpUrl);
      promises.push(
        transporter.sendMail({
          from: process.env['SMTP_FROM'] || 'noreply@curtainai.in',
          to: settings.escalation_email,
          subject: `[Curtain] Escalation — query needs human review`,
          text: [
            `A customer query was escalated and needs human review.`,
            ``,
            `Query: ${payload.query}`,
            `Decision: ${payload.decision}`,
            `Confidence: ${Math.round(payload.confidence * 100)}%`,
            ``,
            `Query ID: ${payload.query_id}`,
            `Workspace: ${payload.workspace_id}`,
          ].join('\n'),
        }).catch(err => {
          logger.warn('escalation.email_failed', { error: String(err), query_id: payload.query_id });
        })
      );
    }
  }

  if (promises.length > 0) await Promise.allSettled(promises);
}

export const escalationService = {
  async listEscalations(
    workspaceId: string,
    status: 'open' | 'resolved' | 'all',
    page: number,
    limit: number
  ) {
    return queryRepository.findEscalated(workspaceId, status, page, limit);
  },

  async resolve(id: string, workspaceId: string, note?: string) {
    const query = await queryRepository.findById(id);
    if (query.workspace_id !== workspaceId) throw new AppError('Escalation not found', 404);
    if (!query.escalated) throw new AppError('Query was not escalated', 400);
    if (query.escalation_status === 'resolved') throw new AppError('Already resolved', 400);
    return queryRepository.resolveEscalation(id, workspaceId, note);
  },
};
