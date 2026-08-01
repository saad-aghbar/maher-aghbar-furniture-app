import type { WhatsAppMessage, WhatsAppProvider } from './types';

export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'console';

  async send(message: WhatsAppMessage) {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:console] to=${message.to} body=${message.body.slice(0, 500)}`);
    return { ok: true, id: `console-wa-${Date.now()}` };
  }
}
