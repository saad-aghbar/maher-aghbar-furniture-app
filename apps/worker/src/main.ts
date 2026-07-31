import { createLogger } from '@maher/logging';

const logger = createLogger('worker');

const queues = ['emails', 'sms', 'whatsapp', 'pdf', 'ai', 'ocr', 'translation', 'reports', 'notifications', 'file-processing'];

async function main() {
  logger.info('Maher ERP worker starting', { queues });
  logger.info('Providers', {
    email: process.env.EMAIL_PROVIDER ?? 'console',
    sms: process.env.SMS_PROVIDER ?? 'console',
    whatsapp: process.env.WHATSAPP_PROVIDER ?? 'console',
    ai: process.env.AI_PROVIDER ?? 'mock',
    ocr: process.env.OCR_PROVIDER ?? 'mock',
  });

  // Local/dev: idle process that documents job contract.
  // Production wires BullMQ workers against REDIS_URL.
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('REDIS_URL not set — worker idle (mock mode)');
  } else {
    logger.info('Redis configured', { redisUrl: redisUrl.replace(/:[^:@]+@/, ':***@') });
  }

  setInterval(() => {
    logger.debug('worker heartbeat');
  }, 60_000);
}

main().catch((err) => {
  logger.error('Worker failed', { err: String(err) });
  process.exit(1);
});
