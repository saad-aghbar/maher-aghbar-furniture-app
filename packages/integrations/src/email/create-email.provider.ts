import type { EmailProvider } from './types';
import { ConsoleEmailProvider } from './console-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';

export function createEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const forced = (env.EMAIL_PROVIDER ?? '').toLowerCase();
  const smtpUrl = env.SMTP_URL?.trim();

  if (forced === 'console' || !smtpUrl) {
    return new ConsoleEmailProvider();
  }

  return new SmtpEmailProvider(smtpUrl);
}
