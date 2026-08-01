import type { WhatsAppProvider } from './types';
import { ConsoleWhatsAppProvider } from './console-whatsapp.provider';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';

export function createWhatsAppProvider(env: NodeJS.ProcessEnv = process.env): WhatsAppProvider {
  const forced = (env.WHATSAPP_PROVIDER ?? '').toLowerCase();
  const token = env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (forced === 'console' || !token || !phoneNumberId) {
    return new ConsoleWhatsAppProvider();
  }

  return new MetaWhatsAppProvider(token, phoneNumberId);
}
