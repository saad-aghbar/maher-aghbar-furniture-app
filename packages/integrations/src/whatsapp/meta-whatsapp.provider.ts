import type { WhatsAppMessage, WhatsAppProvider } from './types';

/** Meta WhatsApp Cloud API */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta';

  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
  ) {}

  async send(message: WhatsAppMessage) {
    const to = message.to.replace(/[^\d+]/g, '').replace(/^\+/, '');
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message.body },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WhatsApp Cloud API failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as { messages?: Array<{ id?: string }> };
    return { ok: true, id: json.messages?.[0]?.id };
  }
}
