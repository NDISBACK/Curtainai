import { AppError } from '../utils/AppError';

export interface WhatsAppConfig {
  api_token:           string;
  phone_number_id:     string;
  business_account_id: string;
}

const GRAPH_API = 'https://graph.facebook.com/v19.0';

async function graphFetch(url: string, token: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json() as any;
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      throw new AppError(`WhatsApp API auth failed: ${msg}`, 401);
    }
    throw new AppError(`WhatsApp API error: ${msg}`, 502);
  }
  return body;
}

export const whatsappService = {
  async validateConfig(config: WhatsAppConfig): Promise<{ valid: boolean; display_phone_number: string }> {
    const data = await graphFetch(
      `${GRAPH_API}/${config.phone_number_id}?fields=display_phone_number,verified_name`,
      config.api_token
    );
    return { valid: true, display_phone_number: data.display_phone_number ?? '' };
  },

  async fetchRecentConversations(
    config: WhatsAppConfig,
    limit = 25
  ): Promise<Array<{ conversationId: string; conversation: string }>> {
    // The Business Management API /conversations endpoint returns conversation threads
    // Note: limited to recent conversations available via the API
    let data;
    try {
      data = await graphFetch(
        `${GRAPH_API}/${config.business_account_id}/conversations` +
        `?fields=messages{from,timestamp,text}&limit=${limit}`,
        config.api_token
      );
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`WhatsApp fetch failed: ${err.message}`, 502);
    }

    const convos: Array<{ conversationId: string; conversation: string }> = [];
    for (const convo of data.data ?? []) {
      const messages: string[] = [];
      for (const msg of convo.messages?.data ?? []) {
        if (msg.text) {
          const ts = msg.timestamp
            ? new Date(msg.timestamp * 1000).toISOString()
            : '';
          messages.push(`${msg.from ?? 'unknown'} (${ts}): ${msg.text}`);
        }
      }
      if (messages.length > 0) {
        convos.push({
          conversationId: convo.id,
          conversation: `WhatsApp Conversation\n\n${messages.join('\n')}`,
        });
      }
    }

    return convos;
  },
};
