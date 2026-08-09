import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('Asia/Amman'),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  API_URL: z.string().url().optional(),
  ADMIN_WEB_URL: z.string().url().optional(),
  CUSTOMER_PORTAL_URL: z.string().url().optional(),
  EMPLOYEE_PORTAL_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  FILE_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  DEFAULT_CURRENCY: z.literal('JOD').default('JOD'),
  DEFAULT_LOCALE: z.enum(['ar', 'en', 'he']).default('ar'),
  DEFAULT_VAT_RATE: z.coerce.number().min(0).max(1).default(0.16),
  COMPANY_NAME_AR: z.string().optional(),
  COMPANY_NAME_EN: z.string().optional(),

  EMAIL_PROVIDER: z.string().default('console'),
  SMS_PROVIDER: z.string().default('console'),
  WHATSAPP_PROVIDER: z.string().default('console'),
  AI_PROVIDER: z.string().default('mock'),
  OCR_PROVIDER: z.string().default('mock'),
  VIRUS_SCAN_PROVIDER: z.string().default('noop'),

  OPENAI_API_KEY: z.string().optional(),
  OCR_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  AI_LLM_MODEL: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  EMAIL_INBOUND_HOST: z.string().optional(),
  EMAIL_INBOUND_PORT: z.coerce.number().int().positive().optional(),
  EMAIL_INBOUND_SECURE: z.enum(['true', 'false']).optional(),
  EMAIL_INBOUND_USER: z.string().optional(),
  EMAIL_INBOUND_PASS: z.string().optional(),
  EMAIL_INBOUND_MAILBOX: z.string().optional(),
  EMAIL_INBOUND_POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
  EMAIL_INBOUND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_INBOUND_ADMIN_NOTIFY_EMAIL: z.string().email().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}

export { envSchema };
