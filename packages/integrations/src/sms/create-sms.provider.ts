import type { SmsProvider } from './types';
import { ConsoleSmsProvider } from './console-sms.provider';
import { TwilioSmsProvider } from './twilio-sms.provider';

export function createSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  const forced = (env.SMS_PROVIDER ?? '').toLowerCase();
  const sid = env.TWILIO_ACCOUNT_SID?.trim();
  const token = env.TWILIO_AUTH_TOKEN?.trim();
  const from = env.TWILIO_SMS_FROM?.trim() || env.TWILIO_FROM?.trim();

  if (forced === 'console' || forced === 'mock') return new ConsoleSmsProvider();
  if ((forced === 'twilio' || (!forced && sid && token && from)) && sid && token && from) {
    return new TwilioSmsProvider(sid, token, from);
  }
  return new ConsoleSmsProvider();
}
