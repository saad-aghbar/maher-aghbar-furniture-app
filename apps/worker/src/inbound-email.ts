import { createLogger } from '@maher/logging';
import {
  createInboundEmailReader,
  isInboundEmailConfigured,
  readInboundEmailConfig,
  type InboundEmailMessage,
} from '@maher/integrations';

const logger = createLogger('inbound-email');

async function forwardToApi(message: InboundEmailMessage) {
  const config = readInboundEmailConfig();
  const apiUrl = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

  if (!config.webhookSecret) {
    logger.warn(
      '[inbound-email] EMAIL_INBOUND_WEBHOOK_SECRET unset — cannot forward polled message to API',
    );
    return;
  }

  const res = await fetch(`${apiUrl}/api/v1/webhooks/inbound-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-inbound-email-secret': config.webhookSecret,
    },
    body: JSON.stringify({
      messageId: message.messageId,
      from: message.from,
      subject: message.subject,
      text: message.text,
      attachments: message.attachments.map((a) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        contentBase64: a.content.toString('base64'),
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API webhook failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  logger.info('[inbound-email] processed message', {
    messageId: message.messageId,
    from: message.from,
    result: json,
  });
}

export function startInboundEmailPoller() {
  const config = readInboundEmailConfig();
  const reader = createInboundEmailReader();
  const intervalMs = config.pollIntervalMs ?? 60_000;

  if (!isInboundEmailConfigured()) {
    logger.info('[inbound-email:mock] EMAIL_INBOUND_* not set — IMAP polling disabled');
    setInterval(() => {
      logger.debug(
        '[inbound-email:mock] heartbeat — set EMAIL_INBOUND_HOST/USER/PASS to enable IMAP polling',
      );
    }, intervalMs);
    return;
  }

  logger.info('[inbound-email] IMAP poller enabled', {
    host: config.host,
    mailbox: config.mailbox,
    intervalMs,
  });

  const tick = async () => {
    try {
      const { messages, provider } = await reader.poll();
      if (!messages.length) {
        logger.debug(`[inbound-email:${provider}] no new messages`);
        return;
      }
      logger.info(`[inbound-email:${provider}] fetched ${messages.length} message(s)`);
      for (const message of messages) {
        await forwardToApi(message);
      }
    } catch (err) {
      logger.error('[inbound-email] poll failed', { err: String(err) });
    }
  };

  void tick();
  setInterval(() => void tick(), intervalMs);
}
