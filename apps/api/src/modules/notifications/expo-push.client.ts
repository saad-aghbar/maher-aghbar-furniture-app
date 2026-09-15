import { Injectable, Logger } from '@nestjs/common';

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound?: 'default' | null;
  channelId?: string;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
};

export type ExpoTicket = {
  token: string;
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  error?: string;
};

type ExpoSendResponse = {
  data?: Array<{
    status?: string;
    id?: string;
    message?: string;
    details?: { error?: string };
  }>;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100;

@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);

  async send(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
    if (messages.length === 0) return [];
    const tickets: ExpoTicket[] = [];
    for (let i = 0; i < messages.length; i += CHUNK) {
      const chunk = messages.slice(i, i + CHUNK);
      const part = await this.sendChunk(chunk);
      tickets.push(...part);
    }
    return tickets;
  }

  private async sendChunk(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });
      const json = (await res.json()) as ExpoSendResponse;
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}`);
        return messages.map((msg) => ({
          token: msg.to,
          status: 'error',
          message: `http_${res.status}`,
        }));
      }
      const rows = json.data ?? [];
      return messages.map((msg, index) => {
        const row = rows[index];
        if (!row) return { token: msg.to, status: 'error', message: 'missing_ticket' };
        if (row.status === 'ok') {
          return { token: msg.to, status: 'ok', id: row.id };
        }
        return {
          token: msg.to,
          status: 'error',
          message: row.message,
          error: row.details?.error,
        };
      });
    } catch (err) {
      this.logger.warn(`Expo push failed: ${String(err)}`);
      return messages.map((msg) => ({
        token: msg.to,
        status: 'error',
        message: String(err),
      }));
    }
  }
}
