import type { InboundEmailConfig, InboundEmailPollResult, InboundEmailReader } from './types';

function extractAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

/** IMAP poller — loads imapflow + mailparser dynamically when configured. */
export class ImapInboundEmailReader implements InboundEmailReader {
  readonly name = 'imap';

  constructor(private readonly config: InboundEmailConfig) {}

  async poll(): Promise<InboundEmailPollResult> {
    const { ImapFlow } = await import('imapflow');
    const { simpleParser } = await import('mailparser');

    const client = new ImapFlow({
      host: this.config.host!,
      port: this.config.port ?? (this.config.secure ? 993 : 143),
      secure: this.config.secure ?? true,
      auth: {
        user: this.config.user!,
        pass: this.config.pass!,
      },
      logger: false,
    });

    const messages: InboundEmailPollResult['messages'] = [];

    await client.connect();
    try {
      const lock = await client.getMailboxLock(this.config.mailbox ?? 'INBOX');
      try {
        for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const from = extractAddress(parsed.from?.text ?? '');
          if (!from) continue;

          const attachments = (parsed.attachments ?? [])
            .filter((a) => a.content && a.content.length > 0)
            .map((a) => ({
              filename: a.filename ?? 'attachment',
              mimeType: a.contentType ?? 'application/octet-stream',
              content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
            }));

          const htmlText =
            typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]+>/g, ' ') : '';
          messages.push({
            messageId: parsed.messageId ?? `uid-${msg.uid}`,
            from,
            subject: parsed.subject ?? '(no subject)',
            text: parsed.text ?? htmlText,
            receivedAt: parsed.date ?? new Date(),
            attachments,
          });

          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return { messages, provider: this.name };
  }
}
