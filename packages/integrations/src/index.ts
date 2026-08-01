export type { OcrProvider, OcrResult } from './ocr/types';
export { MockOcrProvider } from './ocr/mock-ocr.provider';
export { OpenAiVisionOcrProvider } from './ocr/openai-vision-ocr.provider';
export { HttpOcrProvider } from './ocr/http-ocr.provider';
export { createOcrProvider } from './ocr/create-ocr.provider';

export type {
  AiProviders,
  ExtractionProvider,
  ExtractionResult,
  ExtractedField,
  SupportedLocale,
  TranslateProvider,
} from './ai/types';
export { MockTranslateProvider, MockExtractionProvider } from './ai/mock-ai.provider';
export { OpenAiTranslateProvider, OpenAiExtractionProvider } from './ai/openai-ai.provider';
export { createAiProviders } from './ai/create-ai.provider';

export type { EmailMessage, EmailProvider } from './email/types';
export { ConsoleEmailProvider } from './email/console-email.provider';
export { SmtpEmailProvider } from './email/smtp-email.provider';
export { createEmailProvider } from './email/create-email.provider';

export type { WhatsAppMessage, WhatsAppProvider } from './whatsapp/types';
export { ConsoleWhatsAppProvider } from './whatsapp/console-whatsapp.provider';
export { MetaWhatsAppProvider } from './whatsapp/meta-whatsapp.provider';
export { createWhatsAppProvider } from './whatsapp/create-whatsapp.provider';

export type {
  JoFotaraClearanceResult,
  JoFotaraInvoicePayload,
  JoFotaraProvider,
} from './jofotara/types';
export { JoFotaraHttpProvider, createJoFotaraProvider } from './jofotara/jofotara.provider';
