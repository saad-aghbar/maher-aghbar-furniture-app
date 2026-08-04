import type { SmsMessage, SmsProvider } from './types';

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';

  async send(message: SmsMessage) {
    // eslint-disable-next-line no-console
    console.log(`[sms:console] to=${message.to} body=${message.body.slice(0, 500)}`);
    return { ok: true, id: `console-sms-${Date.now()}` };
  }
}
