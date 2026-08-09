import type { EmailProvider } from './types';
import { ConsoleEmailProvider } from './console-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';
import { ResendEmailProvider } from './resend-email.provider';

function looksLikeResendApiKey(value: string): boolean {
  return /^re_[A-Za-z0-9_]+/.test(value);
}

function looksLikeSmtpUrl(value: string): boolean {
  return /^(smtp|smtps|mail):\/\//i.test(value);
}

export function createEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const forced = (env.EMAIL_PROVIDER ?? '').toLowerCase();
  if (forced === 'console' || forced === 'mock') {
    return new ConsoleEmailProvider();
  }

  const resendKey =
    env.RESEND_API_KEY?.trim() ||
    (looksLikeResendApiKey(env.SMTP_URL?.trim() ?? '') ? env.SMTP_URL!.trim() : undefined);

  if (forced === 'resend' || (resendKey && forced !== 'smtp')) {
    if (resendKey) return new ResendEmailProvider(resendKey);
  }

  const smtpUrl = env.SMTP_URL?.trim();
  if (smtpUrl && looksLikeSmtpUrl(smtpUrl)) {
    return new SmtpEmailProvider(smtpUrl);
  }

  // Misconfigured live provider — stay on console rather than crashing on first send.
  if (forced === 'smtp' || forced === 'resend') {
    console.warn(
      `[email] EMAIL_PROVIDER=${forced} but credentials missing/invalid — using console`,
    );
  }

  return new ConsoleEmailProvider();
}
