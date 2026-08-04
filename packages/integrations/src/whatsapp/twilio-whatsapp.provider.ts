import type { WhatsAppMessage, WhatsAppProvider } from './types';

/** Twilio WhatsApp sender (`whatsapp:+E164`). */
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'twilio';

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromWhatsApp: string,
  ) {}

  async send(message: WhatsAppMessage) {
    const digits = message.to.replace(/[^\d+]/g, '').replace(/^\+/, '');
    const to = `whatsapp:+${digits}`;
    const from = this.fromWhatsApp.startsWith('whatsapp:')
      ? this.fromWhatsApp
      : `whatsapp:${this.fromWhatsApp.startsWith('+') ? this.fromWhatsApp : `+${this.fromWhatsApp}`}`;

    const body = new URLSearchParams({
      To: to,
      From: from,
      Body: message.body,
    });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio WhatsApp failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { sid?: string };
    return { ok: true, id: json.sid };
  }
}
