import { AppError } from '../utils/AppError';

export interface FreshdeskConfig {
  domain:  string;   // e.g. "mycompany.freshdesk.com"
  api_key: string;
}

function basicAuth(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:X`).toString('base64')}`;
}

async function fdFetch(url: string, apiKey: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Authorization: basicAuth(apiKey),
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json() as any;
      msg = body?.description ?? body?.message ?? msg;
    } catch { /* ignore parse error */ }
    if (res.status === 401) throw new AppError(`Freshdesk auth failed: invalid API key`, 401);
    if (res.status === 404) throw new AppError(`Freshdesk domain not found: ${url}`, 404);
    throw new AppError(`Freshdesk API error: ${msg}`, 502);
  }
  return res.json();
}

function formatTicket(ticket: any): string {
  const lines: string[] = [
    `Ticket #${ticket.id}: ${ticket.subject ?? '(no subject)'}`,
    ``,
    `Customer: ${ticket.requester?.name ?? 'unknown'}`,
    ``,
    ticket.description_text ?? ticket.description ?? '(no description)',
  ];

  for (const conv of ticket.conversations ?? []) {
    if (conv.body_text || conv.body) {
      const author = conv.incoming ? 'Customer' : 'Agent';
      lines.push('---');
      lines.push(`${author}: ${conv.body_text ?? conv.body}`);
    }
  }

  return lines.join('\n');
}

export const freshdeskService = {
  async validateConfig(config: FreshdeskConfig): Promise<{ valid: boolean; agent_name: string }> {
    const data = await fdFetch(
      `https://${config.domain}/api/v2/agents/me`,
      config.api_key
    );
    return { valid: true, agent_name: data?.contact?.name ?? '' };
  },

  async fetchRecentTickets(
    config: FreshdeskConfig,
    limit = 25
  ): Promise<Array<{ ticketId: number; conversation: string }>> {
    // Fetch resolved tickets with their conversations
    const tickets = await fdFetch(
      `https://${config.domain}/api/v2/tickets?status=5&per_page=${limit}&include=conversations,requester&order_by=updated_at&order_type=desc`,
      config.api_key
    );

    return (tickets ?? []).map((t: any) => ({
      ticketId: t.id,
      conversation: formatTicket(t),
    }));
  },
};
