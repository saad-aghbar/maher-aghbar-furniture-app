import type { WhatsAppProvider } from './types';
import { ConsoleWhatsAppProvider } from './console-whatsapp.provider';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';
import { TwilioWhatsAppProvider } from './twilio-whatsapp.provider';

export function createWhatsAppProvider(env: NodeJS.ProcessEnv = process.env): WhatsAppProvider {
  const forced = (env.WHATSAPP_PROVIDER ?? '').toLowerCase();
  const metaToken = env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const twilioSid = env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom =
    env.TWILIO_WHATSAPP_FROM?.trim() ||
    env.TWILIO_FROM?.trim() ||
    '';

  if (forced === 'console' || forced === 'mock') {
    return new ConsoleWhatsAppProvider();
  }

  if (forced === 'twilio') {
    if (twilioSid && twilioToken && twilioFrom) {
      return new TwilioWhatsAppProvider(twilioSid, twilioToken, twilioFrom);
    }
    return new ConsoleWhatsAppProvider();
  }

  if (forced === 'meta') {
    if (metaToken && phoneNumberId) {
      return new MetaWhatsAppProvider(metaToken, phoneNumberId);
    }
    return new ConsoleWhatsAppProvider();
  }

  // Auto: prefer Meta Cloud, then Twilio WhatsApp, else console.
  if (metaToken && phoneNumberId) {
    return new MetaWhatsAppProvider(metaToken, phoneNumberId);
  }
  if (twilioSid && twilioToken && twilioFrom) {
    return new TwilioWhatsAppProvider(twilioSid, twilioToken, twilioFrom);
  }
  return new ConsoleWhatsAppProvider();
}
