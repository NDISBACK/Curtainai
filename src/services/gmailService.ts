import { google } from 'googleapis';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    env.google.clientId,
    env.google.clientSecret,
    env.google.redirectUri
  );
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64').toString('utf8');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTextFromParts(parts: any[]): string {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      const nested = extractTextFromParts(part.parts);
      if (nested) return nested;
    }
  }
  // Fall back to HTML
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return stripHtml(decodeBase64Url(part.body.data));
    }
    if (part.parts) {
      const nested = extractTextFromParts(part.parts);
      if (nested) return nested;
    }
  }
  return '';
}

function formatMessage(msg: any): string {
  const headers: Record<string, string> = {};
  for (const h of msg.payload?.headers ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  const subject = headers['subject'] ?? '(no subject)';
  const from    = headers['from'] ?? '(unknown)';
  const date    = headers['date'] ?? '';

  let body = '';
  if (msg.payload?.body?.data) {
    body = decodeBase64Url(msg.payload.body.data);
  } else if (msg.payload?.parts) {
    body = extractTextFromParts(msg.payload.parts);
  }

  return `Subject: ${subject}\nFrom: ${from}\nDate: ${date}\n\n${body.trim()}`;
}

export const gmailService = {
  getAuthUrl(workspaceId: string): string {
    if (!env.google.clientId || !env.google.clientSecret) {
      throw new AppError('Gmail integration is not configured on this server', 503);
    }
    const auth = makeOAuth2Client();
    return auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      state: workspaceId,
    });
  },

  async exchangeCode(code: string): Promise<{ refresh_token: string; email: string }> {
    const auth = makeOAuth2Client();
    let tokens;
    try {
      const result = await auth.getToken(code);
      tokens = result.tokens;
    } catch (err: any) {
      throw new AppError(`Gmail OAuth failed: ${err.message}`, 502);
    }

    if (!tokens.refresh_token) {
      throw new AppError('Gmail did not return a refresh token. Revoke app access and try again.', 400);
    }

    auth.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth });
    let email = '';
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      email = profile.data.emailAddress ?? '';
    } catch {
      // Non-fatal — we still have the refresh token
    }

    return { refresh_token: tokens.refresh_token, email };
  },

  // Fetch all threads up to maxResults using pagination, with optional progress callback
  async fetchAllThreads(
    refreshToken: string,
    maxResults: number,
    onProgress?: (fetched: number, total: number) => void
  ): Promise<Array<{ threadId: string; conversation: string }>> {
    const auth = makeOAuth2Client();
    auth.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // Phase 1: collect thread stubs via pagination
    const stubs: string[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const page = await gmail.users.threads.list({
          userId: 'me',
          maxResults: Math.min(100, maxResults - stubs.length),
          labelIds: ['INBOX'],
          ...(pageToken ? { pageToken } : {}),
        });
        for (const t of page.data.threads ?? []) {
          if (t.id) stubs.push(t.id);
        }
        pageToken = page.data.nextPageToken ?? undefined;
      } while (pageToken && stubs.length < maxResults);
    } catch (err: any) {
      if (err.status === 401) throw new AppError('Gmail token expired — please reconnect', 401);
      throw new AppError(`Gmail API error: ${err.message}`, 502);
    }

    const total = stubs.length;
    onProgress?.(0, total);

    // Phase 2: fetch full thread details in batches of 10
    const BATCH = 10;
    const results: Array<{ threadId: string; conversation: string }> = [];

    for (let i = 0; i < stubs.length; i += BATCH) {
      const chunk = stubs.slice(i, i + BATCH);
      await Promise.all(chunk.map(async (id) => {
        try {
          const detail = await gmail.users.threads.get({ userId: 'me', id, format: 'full' });
          const messages = detail.data.messages ?? [];
          const parts = messages.map(formatMessage).filter(Boolean);
          if (parts.length > 0) {
            results.push({
              threadId: id,
              conversation: parts.join('\n---\n').slice(0, 8000),
            });
          }
        } catch {
          // Skip failed threads
        }
      }));
      onProgress?.(Math.min(i + BATCH, total), total);
    }

    return results;
  },
};
