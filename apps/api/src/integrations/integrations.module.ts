import { Global, Module } from '@nestjs/common';
import {
  createAiProviders,
  createEmailProvider,
  createJoFotaraProvider,
  createOcrProvider,
  createSmsProvider,
  createWhatsAppProvider,
  type AiProviders,
  type EmailProvider,
  type ExtractionProvider,
  type JoFotaraProvider,
  type OcrProvider,
  type SmsProvider,
  type TranslateProvider,
  type WhatsAppProvider,
} from '@maher/integrations';

export const OCR_PROVIDER = 'OCR_PROVIDER';
export const TRANSLATE_PROVIDER = 'TRANSLATE_PROVIDER';
export const EXTRACTION_PROVIDER = 'EXTRACTION_PROVIDER';
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
export const SMS_PROVIDER = 'SMS_PROVIDER';
export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';
export const JOFOTARA_PROVIDER = 'JOFOTARA_PROVIDER';

const ai = createAiProviders();

@Global()
@Module({
  providers: [
    { provide: OCR_PROVIDER, useFactory: (): OcrProvider => createOcrProvider() },
    { provide: TRANSLATE_PROVIDER, useValue: ai.translate as TranslateProvider },
    { provide: EXTRACTION_PROVIDER, useValue: ai.extract as ExtractionProvider },
    {
      provide: 'AI_PROVIDERS',
      useValue: ai as AiProviders,
    },
    { provide: EMAIL_PROVIDER, useFactory: (): EmailProvider => createEmailProvider() },
    { provide: SMS_PROVIDER, useFactory: (): SmsProvider => createSmsProvider() },
    {
      provide: WHATSAPP_PROVIDER,
      useFactory: (): WhatsAppProvider => createWhatsAppProvider(),
    },
    {
      provide: JOFOTARA_PROVIDER,
      useFactory: (): JoFotaraProvider => createJoFotaraProvider(),
    },
  ],
  exports: [
    OCR_PROVIDER,
    TRANSLATE_PROVIDER,
    EXTRACTION_PROVIDER,
    'AI_PROVIDERS',
    EMAIL_PROVIDER,
    SMS_PROVIDER,
    WHATSAPP_PROVIDER,
    JOFOTARA_PROVIDER,
  ],
})
export class IntegrationsModule {}
