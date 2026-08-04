export interface InboundEmailAttachment {
  filename: string;
  mimeType: string;
  content: Buffer;
}

export interface InboundEmailMessage {
  messageId: string;
  from: string;
  subject: string;
  text: string;
  receivedAt: Date;
  attachments: InboundEmailAttachment[];
}

export interface InboundEmailPollResult {
  messages: InboundEmailMessage[];
  provider: string;
}

export interface InboundEmailReader {
  readonly name: string;
  poll(): Promise<InboundEmailPollResult>;
}

export interface InboundEmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  mailbox?: string;
  pollIntervalMs?: number;
  webhookSecret?: string;
  adminNotifyEmail?: string;
}

export function readInboundEmailConfig(env: NodeJS.ProcessEnv = process.env): InboundEmailConfig {
  return {
    host: env.EMAIL_INBOUND_HOST?.trim() || undefined,
    port: env.EMAIL_INBOUND_PORT ? Number(env.EMAIL_INBOUND_PORT) : undefined,
    secure: env.EMAIL_INBOUND_SECURE === 'true',
    user: env.EMAIL_INBOUND_USER?.trim() || undefined,
    pass: env.EMAIL_INBOUND_PASS?.trim() || undefined,
    mailbox: env.EMAIL_INBOUND_MAILBOX?.trim() || 'INBOX',
    pollIntervalMs: env.EMAIL_INBOUND_POLL_INTERVAL_MS
      ? Number(env.EMAIL_INBOUND_POLL_INTERVAL_MS)
      : 60_000,
    webhookSecret: env.EMAIL_INBOUND_WEBHOOK_SECRET?.trim() || undefined,
    adminNotifyEmail: env.EMAIL_INBOUND_ADMIN_NOTIFY_EMAIL?.trim() || undefined,
  };
}

export function isInboundEmailConfigured(config: InboundEmailConfig = readInboundEmailConfig()): boolean {
  return Boolean(config.host && config.user && config.pass);
}
