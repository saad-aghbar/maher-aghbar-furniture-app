import type { EmailMessage, EmailProvider } from './types';

/** Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from =
      process.env.SMTP_FROM?.trim() ||
      process.env.RESEND_FROM?.trim() ||
      process.env.COMPANY_EMAIL?.trim() ||
      'Maher Al-Aghbar <beth.t@example.com>',
  ) {}

  async send(message: EmailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.body,
        html: message.html ?? message.body.replace(/\n/g, '<br/>'),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend email failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  }
}
