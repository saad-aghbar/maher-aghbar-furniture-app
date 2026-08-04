import type { SmsMessage, SmsProvider } from './types';

/** Twilio Programmable Messaging (SMS). */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(message: SmsMessage) {
    const to = message.to.replace(/[^\d+]/g, '');
    const body = new URLSearchParams({
      To: to.startsWith('+') ? to : `+${to}`,
      From: this.from,
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
      throw new Error(`Twilio SMS failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { sid?: string };
    return { ok: true, id: json.sid };
  }
}
