import type { EmailMessage, EmailProvider } from './types';

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async send(message: EmailMessage) {
    // eslint-disable-next-line no-console
    console.log(
      `[email:console] to=${message.to} subject=${message.subject} body=${message.body.slice(0, 500)}`,
    );
    return { ok: true, id: `console-${Date.now()}` };
  }
}
